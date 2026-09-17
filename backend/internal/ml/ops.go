package ml

import (
	"math"
)

// MatVecMul computes y = W * x + b, where W is (outDim, inDim), x is (inDim), b is (outDim).
func MatVecMul(w [][]float32, x []float32, b []float32) []float32 {
	outDim := len(w)
	y := make([]float32, outDim)
	for i := 0; i < outDim; i++ {
		var sum float32
		row := w[i]
		inDim := len(row)
		for j := 0; j < inDim; j++ {
			sum += row[j] * x[j]
		}
		if b != nil && i < len(b) {
			sum += b[i]
		}
		y[i] = sum
	}
	return y
}

// MatVecMulFlat computes y = W * x + b where W is a flat 1D slice of size outDim * inDim.
func MatVecMulFlat(w []float32, outDim, inDim int, x []float32, b []float32) []float32 {
	y := make([]float32, outDim)
	for i := 0; i < outDim; i++ {
		var sum float32
		rowOffset := i * inDim
		for j := 0; j < inDim; j++ {
			sum += w[rowOffset+j] * x[j]
		}
		if b != nil && i < len(b) {
			sum += b[i]
		}
		y[i] = sum
	}
	return y
}

// ELU applies the Exponential Linear Unit activation: x > 0 ? x : alpha * (exp(x) - 1).
func ELU(x []float32, alpha float32) []float32 {
	out := make([]float32, len(x))
	for i, v := range x {
		if v > 0 {
			out[i] = v
		} else {
			out[i] = alpha * float32(math.Expm1(float64(v)))
		}
	}
	return out
}

// ReLU applies the Rectified Linear Unit activation: max(0, x).
func ReLU(x []float32) []float32 {
	out := make([]float32, len(x))
	for i, v := range x {
		if v > 0 {
			out[i] = v
		} else {
			out[i] = 0
		}
	}
	return out
}

// Sigmoid computes 1 / (1 + exp(-x)) element-wise.
func Sigmoid(x []float32) []float32 {
	out := make([]float32, len(x))
	for i, v := range x {
		out[i] = float32(1.0 / (1.0 + math.Exp(-float64(v))))
	}
	return out
}

// Tanh computes tanh(x) element-wise.
func Tanh(x []float32) []float32 {
	out := make([]float32, len(x))
	for i, v := range x {
		out[i] = float32(math.Tanh(float64(v)))
	}
	return out
}

// Softmax computes the numerically stable softmax over vector x.
func Softmax(x []float32) []float32 {
	n := len(x)
	if n == 0 {
		return []float32{}
	}

	maxVal := x[0]
	for i := 1; i < n; i++ {
		if x[i] > maxVal {
			maxVal = x[i]
		}
	}

	out := make([]float32, n)
	var sum float64
	for i := 0; i < n; i++ {
		expVal := math.Exp(float64(x[i] - maxVal))
		out[i] = float32(expVal)
		sum += expVal
	}

	if sum > 0 {
		invSum := float32(1.0 / sum)
		for i := 0; i < n; i++ {
			out[i] *= invSum
		}
	}
	return out
}

// LayerNorm computes layer normalization with learnable weight (gamma) and bias (beta).
// y = ((x - mean) / sqrt(var + eps)) * weight + bias
func LayerNorm(x []float32, weight []float32, bias []float32, eps float32) []float32 {
	n := len(x)
	if n == 0 {
		return []float32{}
	}

	var sum float64
	for _, v := range x {
		sum += float64(v)
	}
	mean := sum / float64(n)

	var varSum float64
	for _, v := range x {
		diff := float64(v) - mean
		varSum += diff * diff
	}
	stdDev := float32(math.Sqrt(varSum/float64(n) + float64(eps)))

	out := make([]float32, n)
	for i := 0; i < n; i++ {
		norm := (x[i] - float32(mean)) / stdDev
		w := float32(1.0)
		b := float32(0.0)
		if weight != nil && i < len(weight) {
			w = weight[i]
		}
		if bias != nil && i < len(bias) {
			b = bias[i]
		}
		out[i] = norm*w + b
	}
	return out
}

// GLU computes Gated Linear Unit: out = a * Sigmoid(b).
func GLU(a []float32, b []float32) []float32 {
	n := len(a)
	out := make([]float32, n)
	for i := 0; i < n; i++ {
		sig := float32(1.0 / (1.0 + math.Exp(-float64(b[i]))))
		out[i] = a[i] * sig
	}
	return out
}

// VecAdd returns a + b.
func VecAdd(a, b []float32) []float32 {
	n := len(a)
	out := make([]float32, n)
	for i := 0; i < n; i++ {
		out[i] = a[i] + b[i]
	}
	return out
}
