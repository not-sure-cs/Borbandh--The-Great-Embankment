package ml

import (
	"archive/zip"
	"encoding/binary"
	"errors"
	"fmt"
	"io"
	"math"
	"os"
	"path/filepath"
	"strings"
)

// TFTPINNWeights contains all extracted tensor slices for the TFT-PINN network.
type TFTPINNWeights struct {
	Tensors [][]float32
}

// LoadWeightsFromPTH reads the raw PyTorch checkpoint zip file directly without Python or CGO.
func LoadWeightsFromPTH(pthPath string) (*TFTPINNModel, error) {
	if _, err := os.Stat(pthPath); err != nil {
		return nil, fmt.Errorf("pth file not found at %s: %w", pthPath, err)
	}

	reader, err := zip.OpenReader(pthPath)
	if err != nil {
		return nil, fmt.Errorf("failed to open pth zip archive: %w", err)
	}
	defer reader.Close()

	// Map of filename to zip.File
	fileMap := make(map[string]*zip.File)
	for _, f := range reader.File {
		// e.g. "best_tft_pinn_embankment/data/0" or "data/0"
		base := filepath.Base(filepath.Dir(f.Name))
		filename := filepath.Base(f.Name)
		if base == "data" {
			fileMap[filename] = f
		}
	}

	const numTensors = 98
	tensors := make([][]float32, numTensors)

	for i := 0; i < numTensors; i++ {
		key := fmt.Sprintf("%d", i)
		zipFile, exists := fileMap[key]
		if !exists {
			return nil, fmt.Errorf("tensor data/%s not found in pth archive", key)
		}

		rc, err := zipFile.Open()
		if err != nil {
			return nil, fmt.Errorf("failed to read tensor data/%s: %w", key, err)
		}

		buf, err := io.ReadAll(rc)
		rc.Close()
		if err != nil {
			return nil, fmt.Errorf("failed to buffer tensor data/%s: %w", key, err)
		}

		if len(buf)%4 != 0 {
			return nil, fmt.Errorf("invalid byte length for float32 tensor data/%s: %d", key, len(buf))
		}

		numFloats := len(buf) / 4
		slice := make([]float32, numFloats)
		for j := 0; j < numFloats; j++ {
			bits := binary.LittleEndian.Uint32(buf[j*4 : (j+1)*4])
			slice[j] = math.Float32frombits(bits)
		}
		tensors[i] = slice
	}

	return BuildModelFromTensors(tensors)
}

// BuildModelFromTensors instantiates and wires the TFT-PINN computation graph.
func BuildModelFromTensors(t [][]float32) (*TFTPINNModel, error) {
	if len(t) < 98 {
		return nil, errors.New("insufficient tensors provided; expected 98")
	}

	model := &TFTPINNModel{}

	// 1. Build 6 single-variable GRNs (indices 0..59)
	for i := 0; i < NumFeatures; i++ {
		base := i * 10
		grn := SingleVariableGRN{
			FC1: Linear{
				Weight: t[base+0],
				Bias:   t[base+1],
				InDim:  1,
				OutDim: 64,
			},
			FC2: Linear{
				Weight: t[base+2],
				Bias:   t[base+3],
				InDim:  64,
				OutDim: 64,
			},
			Gate: Linear{
				Weight: t[base+4],
				Bias:   t[base+5],
				InDim:  1,
				OutDim: 64,
			},
			LayerNorm: LayerNormalization{
				Weight: t[base+6],
				Bias:   t[base+7],
				Dim:    64,
				Eps:    1e-5,
			},
			Residual: Linear{
				Weight: t[base+8],
				Bias:   t[base+9],
				InDim:  1,
				OutDim: 64,
			},
		}
		model.VSN.SingleGRNs[i] = grn
	}

	// 2. Build VSN Weight GRN (indices 60..69)
	model.VSN.WeightGRN = SingleVariableGRN{
		FC1: Linear{
			Weight: t[60],
			Bias:   t[61],
			InDim:  384,
			OutDim: 64,
		},
		FC2: Linear{
			Weight: t[62],
			Bias:   t[63],
			InDim:  64,
			OutDim: 6,
		},
		Gate: Linear{
			Weight: t[64],
			Bias:   t[65],
			InDim:  384,
			OutDim: 6,
		},
		LayerNorm: LayerNormalization{
			Weight: t[66],
			Bias:   t[67],
			Dim:    6,
			Eps:    1e-5,
		},
		Residual: Linear{
			Weight: t[68],
			Bias:   t[69],
			InDim:  384,
			OutDim: 6,
		},
	}

	// 3. Build LSTM Encoder (indices 70..73)
	model.LSTM = LSTMCell{
		WeightIH:  t[70],
		WeightHH:  t[71],
		BiasIH:    t[72],
		BiasHH:    t[73],
		HiddenDim: 64,
	}

	// 4. Build Post-LSTM GRN (indices 74..81)
	model.PostLSTMGRN = IdentityResidualGRN{
		FC1: Linear{
			Weight: t[74],
			Bias:   t[75],
			InDim:  64,
			OutDim: 64,
		},
		FC2: Linear{
			Weight: t[76],
			Bias:   t[77],
			InDim:  64,
			OutDim: 64,
		},
		Gate: Linear{
			Weight: t[78],
			Bias:   t[79],
			InDim:  64,
			OutDim: 64,
		},
		LayerNorm: LayerNormalization{
			Weight: t[80],
			Bias:   t[81],
			Dim:    64,
			Eps:    1e-5,
		},
	}

	// 5. Build Self-Attention (indices 82..85)
	model.SelfAttention = MultiHeadSelfAttention{
		InProjWeight:  t[82],
		InProjBias:    t[83],
		OutProjWeight: t[84],
		OutProjBias:   t[85],
		EmbedDim:      64,
		NumHeads:      4,
	}

	// 6. Build Post-Attention GRN (indices 86..93)
	model.PostAttGRN = IdentityResidualGRN{
		FC1: Linear{
			Weight: t[86],
			Bias:   t[87],
			InDim:  64,
			OutDim: 64,
		},
		FC2: Linear{
			Weight: t[88],
			Bias:   t[89],
			InDim:  64,
			OutDim: 64,
		},
		Gate: Linear{
			Weight: t[90],
			Bias:   t[91],
			InDim:  64,
			OutDim: 64,
		},
		LayerNorm: LayerNormalization{
			Weight: t[92],
			Bias:   t[93],
			Dim:    64,
			Eps:    1e-5,
		},
	}

	// 7. Build Dense Prediction Head (indices 94..97)
	model.Head = DenseHead{
		FC1: Linear{
			Weight: t[94],
			Bias:   t[95],
			InDim:  64,
			OutDim: 32,
		},
		FC2: Linear{
			Weight: t[96],
			Bias:   t[97],
			InDim:  32,
			OutDim: 24,
		},
	}

	return model, nil
}

// FindModelFile searches candidate relative and absolute paths for best_tft_pinn_embankment.pth.
func FindModelFile(customPath string) (string, error) {
	if customPath != "" {
		if _, err := os.Stat(customPath); err == nil {
			return customPath, nil
		}
	}

	candidates := []string{
		"pyscripts/best_tft_pinn_embankment.pth",
		"../pyscripts/best_tft_pinn_embankment.pth",
		"../../pyscripts/best_tft_pinn_embankment.pth",
		"/Users/knibirdgautam/Documents/CS_Coding_Projects/Go/BorBandh/pyscripts/best_tft_pinn_embankment.pth",
	}

	for _, c := range candidates {
		if _, err := os.Stat(c); err == nil {
			return c, nil
		}
	}

	return "", fmt.Errorf("could not locate best_tft_pinn_embankment.pth in candidate paths: %s", strings.Join(candidates, ", "))
}
