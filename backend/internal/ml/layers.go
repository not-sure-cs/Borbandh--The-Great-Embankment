package ml

import (
	"math"
)

// Linear represents a fully-connected dense layer.
type Linear struct {
	Weight []float32 // flat row-major matrix: OutFeatures x InFeatures
	Bias   []float32 // OutFeatures
	InDim  int
	OutDim int
}

// Forward computes y = W * x + b.
func (l *Linear) Forward(x []float32) []float32 {
	return MatVecMulFlat(l.Weight, l.OutDim, l.InDim, x, l.Bias)
}

// LayerNormalization represents standard layer normalization.
type LayerNormalization struct {
	Weight []float32 // gamma
	Bias   []float32 // beta
	Dim    int
	Eps    float32
}

// Forward applies layer normalization.
func (ln *LayerNormalization) Forward(x []float32) []float32 {
	eps := ln.Eps
	if eps <= 0 {
		eps = 1e-5
	}
	return LayerNorm(x, ln.Weight, ln.Bias, eps)
}

// SingleVariableGRN is a Gated Residual Network with linear residual projection.
// Used for single-variable inputs (InDim=1, OutDim=64) and variable selection weights (InDim=384, OutDim=6).
type SingleVariableGRN struct {
	FC1       Linear
	FC2       Linear
	Gate      Linear
	Residual  Linear
	LayerNorm LayerNormalization
}

// Forward executes the gated residual forward pass:
// eta1 = ELU(fc1(x))
// eta2 = fc2(eta1)
// gate = gate(x)
// gated = GLU(eta2, gate)
// res = residual(x)
// return LayerNorm(res + gated)
func (g *SingleVariableGRN) Forward(x []float32) []float32 {
	eta1 := ELU(g.FC1.Forward(x), 1.0)
	eta2 := g.FC2.Forward(eta1)
	gate := g.Gate.Forward(x)
	gated := GLU(eta2, gate)
	res := g.Residual.Forward(x)
	sum := VecAdd(res, gated)
	return g.LayerNorm.Forward(sum)
}

// IdentityResidualGRN is a GRN where InDim == OutDim (64 -> 64) with identity residual.
// Used for post_lstm_grn and post_att_grn.
type IdentityResidualGRN struct {
	FC1       Linear
	FC2       Linear
	Gate      Linear
	LayerNorm LayerNormalization
}

// Forward executes the gated residual forward pass with identity skip connection:
// eta1 = ELU(fc1(x))
// eta2 = fc2(eta1)
// gate = gate(x)
// gated = GLU(eta2, gate)
// return LayerNorm(x + gated)
func (g *IdentityResidualGRN) Forward(x []float32) []float32 {
	eta1 := ELU(g.FC1.Forward(x), 1.0)
	eta2 := g.FC2.Forward(eta1)
	gate := g.Gate.Forward(x)
	gated := GLU(eta2, gate)
	sum := VecAdd(x, gated)
	return g.LayerNorm.Forward(sum)
}

// VariableSelectionNetwork maps 6 input features into a unified 64-dim embedding.
type VariableSelectionNetwork struct {
	SingleGRNs [NumFeatures]SingleVariableGRN
	WeightGRN  SingleVariableGRN
}

// Forward runs VSN on a 6-element feature vector and returns the combined embedding (64D) and variable weights (6D).
func (vsn *VariableSelectionNetwork) Forward(features []float32) ([]float32, []float32) {
	// 1. Process each individual feature through its respective GRN
	embeddings := make([][]float32, NumFeatures)
	flattened := make([]float32, NumFeatures*64)

	for i := 0; i < NumFeatures; i++ {
		input := []float32{features[i]}
		emb := vsn.SingleGRNs[i].Forward(input)
		embeddings[i] = emb
		copy(flattened[i*64:(i+1)*64], emb)
	}

	// 2. Compute variable weights via WeightGRN + Softmax
	weightLogits := vsn.WeightGRN.Forward(flattened)
	weights := Softmax(weightLogits)

	// 3. Compute weighted sum of embeddings: sum_i w_i * emb_i
	combined := make([]float32, 64)
	for i := 0; i < NumFeatures; i++ {
		w := weights[i]
		emb := embeddings[i]
		for j := 0; j < 64; j++ {
			combined[j] += w * emb[j]
		}
	}

	return combined, weights
}

// LSTMCell executes single-step recurrent LSTM computations with 64D hidden and cell states.
type LSTMCell struct {
	WeightIH []float32 // (256, 64)
	WeightHH []float32 // (256, 64)
	BiasIH   []float32 // (256,)
	BiasHH   []float32 // (256,)
	HiddenDim int
}

// Step computes next (h, c) given input x and previous (h_prev, c_prev).
func (lstm *LSTMCell) Step(x, hPrev, cPrev []float32) ([]float32, []float32) {
	hDim := lstm.HiddenDim
	if hDim == 0 {
		hDim = 64
	}

	// Compute input gates and recurrent gates
	gatesI := MatVecMulFlat(lstm.WeightIH, 4*hDim, hDim, x, lstm.BiasIH)
	gatesH := MatVecMulFlat(lstm.WeightHH, 4*hDim, hDim, hPrev, lstm.BiasHH)

	hNext := make([]float32, hDim)
	cNext := make([]float32, hDim)

	for j := 0; j < hDim; j++ {
		// PyTorch gate order: (i, f, g, o)
		valI := gatesI[j] + gatesH[j]
		valF := gatesI[hDim+j] + gatesH[hDim+j]
		valG := gatesI[2*hDim+j] + gatesH[2*hDim+j]
		valO := gatesI[3*hDim+j] + gatesH[3*hDim+j]

		iGate := float32(1.0 / (1.0 + math.Exp(-float64(valI))))
		fGate := float32(1.0 / (1.0 + math.Exp(-float64(valF))))
		gGate := float32(math.Tanh(float64(valG)))
		oGate := float32(1.0 / (1.0 + math.Exp(-float64(valO))))

		cVal := fGate*cPrev[j] + iGate*gGate
		hVal := oGate * float32(math.Tanh(float64(cVal)))

		cNext[j] = cVal
		hNext[j] = hVal
	}

	return hNext, cNext
}

// MultiHeadSelfAttention implements multi-head scaled dot-product self-attention (embedDim=64, numHeads=4).
type MultiHeadSelfAttention struct {
	InProjWeight  []float32 // (192, 64) -> Q, K, V concatenated
	InProjBias    []float32 // (192,)
	OutProjWeight []float32 // (64, 64)
	OutProjBias   []float32 // (64,)
	EmbedDim      int
	NumHeads      int
}

// Forward computes self-attention over sequence of tokens (seqLen x 64).
func (attn *MultiHeadSelfAttention) Forward(seq [][]float32) [][]float32 {
	seqLen := len(seq)
	if seqLen == 0 {
		return nil
	}

	embedDim := attn.EmbedDim
	if embedDim == 0 {
		embedDim = 64
	}
	numHeads := attn.NumHeads
	if numHeads == 0 {
		numHeads = 4
	}
	headDim := embedDim / numHeads
	scale := float32(1.0 / math.Sqrt(float64(headDim)))

	// 1. Project sequence into Q, K, V
	qSeq := make([][]float32, seqLen)
	kSeq := make([][]float32, seqLen)
	vSeq := make([][]float32, seqLen)

	for t := 0; t < seqLen; t++ {
		proj := MatVecMulFlat(attn.InProjWeight, 3*embedDim, embedDim, seq[t], attn.InProjBias)
		qSeq[t] = proj[0:embedDim]
		kSeq[t] = proj[embedDim : 2*embedDim]
		vSeq[t] = proj[2*embedDim : 3*embedDim]
	}

	// 2. Multi-head scaled dot product
	outSeq := make([][]float32, seqLen)
	for t := 0; t < seqLen; t++ {
		multiHeadConcat := make([]float32, embedDim)

		for h := 0; h < numHeads; h++ {
			headOffset := h * headDim
			// Calculate attention scores for head h against all time steps s
			scores := make([]float32, seqLen)
			for s := 0; s < seqLen; s++ {
				var dot float32
				for d := 0; d < headDim; d++ {
					dot += qSeq[t][headOffset+d] * kSeq[s][headOffset+d]
				}
				scores[s] = dot * scale
			}

			weights := Softmax(scores)

			// Weighted sum over V
			for d := 0; d < headDim; d++ {
				var sum float32
				for s := 0; s < seqLen; s++ {
					sum += weights[s] * vSeq[s][headOffset+d]
				}
				multiHeadConcat[headOffset+d] = sum
			}
		}

		// 3. Out projection
		projected := MatVecMulFlat(attn.OutProjWeight, embedDim, embedDim, multiHeadConcat, attn.OutProjBias)
		outSeq[t] = projected
	}

	return outSeq
}

// DenseHead represents the 2-layer forecast projection head:
// Linear(64, 32) -> ReLU -> Linear(32, 24).
type DenseHead struct {
	FC1 Linear // (32, 64)
	FC2 Linear // (24, 32)
}

// Forward computes the 24-step forecast vector.
func (dh *DenseHead) Forward(x []float32) []float32 {
	h1 := ReLU(dh.FC1.Forward(x))
	return dh.FC2.Forward(h1)
}
