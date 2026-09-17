package ml

import (
	"errors"
)

// TFTPINNModel encapsulates the complete neural network forward computation graph.
type TFTPINNModel struct {
	VSN           VariableSelectionNetwork
	LSTM          LSTMCell
	PostLSTMGRN   IdentityResidualGRN
	SelfAttention MultiHeadSelfAttention
	PostAttGRN    IdentityResidualGRN
	Head          DenseHead
}

// ForwardSequence processes a temporal sequence of scaled feature vectors:
// seq: [seqLen][6] where each element is a 6-feature float32 slice.
// Returns:
// - forecast: 24-step Factor of Safety trajectory [t+1, ..., t+24]
// - lastWeights: variable selection importance weights [6] of the latest reading
func (m *TFTPINNModel) ForwardSequence(seq [][]float32) ([]float64, []float64, error) {
	seqLen := len(seq)
	if seqLen == 0 {
		return nil, nil, errors.New("empty input sequence")
	}

	for _, step := range seq {
		if len(step) != NumFeatures {
			return nil, nil, errors.New("each sequence step must have exactly 6 features")
		}
	}

	h := make([]float32, 64)
	c := make([]float32, 64)

	postLSTMSeq := make([][]float32, seqLen)
	var lastWeights []float32

	// 1. Step through time with VSN + LSTM + Post-LSTM GRN
	for t := 0; t < seqLen; t++ {
		vsnOut, weights := m.VSN.Forward(seq[t])
		if t == seqLen-1 {
			lastWeights = weights
		}

		hNext, cNext := m.LSTM.Step(vsnOut, h, c)
		h = hNext
		c = cNext

		postLSTM := m.PostLSTMGRN.Forward(h)
		postLSTMSeq[t] = postLSTM
	}

	// 2. Multi-Head Self-Attention across time dimension
	attnSeq := m.SelfAttention.Forward(postLSTMSeq)

	// 3. Post-Attention GRN on the most recent temporal state
	latestAttn := attnSeq[seqLen-1]
	postAttn := m.PostAttGRN.Forward(latestAttn)

	// 4. Dense Head to produce 24-hour forecast
	forecast32 := m.Head.Forward(postAttn)

	// Convert results to float64 for application consumers
	forecast := make([]float64, len(forecast32))
	for i, val := range forecast32 {
		forecast[i] = float64(val)
	}

	weights64 := make([]float64, len(lastWeights))
	for i, w := range lastWeights {
		weights64[i] = float64(w)
	}

	return forecast, weights64, nil
}
