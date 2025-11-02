import React, { useState, useMemo } from 'react';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Network, Clock, AlertCircle } from 'lucide-react';

const App = () => {
  const [mainSelection, setMainSelection] = useState(null);
  const [markovType, setMarkovType] = useState(null);
  const [queueModel, setQueueModel] = useState(null);
  const [numStates, setNumStates] = useState(3);
  const [numPeriods, setNumPeriods] = useState(5);
  const [transitionMatrix, setTransitionMatrix] = useState([]);
  const [initialVector, setInitialVector] = useState([]);
  const [initialValues, setInitialValues] = useState([]);
  const [useInitialVector, setUseInitialVector] = useState(false);
  const [absorbingStates, setAbsorbingStates] = useState([]);
  const [matrixInitialized, setMatrixInitialized] = useState(false);
  const [lambda, setLambda] = useState(5);
  const [mu, setMu] = useState(8);
  const [numServers, setNumServers] = useState(1);
  const [systemCapacity, setSystemCapacity] = useState(10);

  const initializeMarkovMatrices = () => {
    const matrix = Array(numStates).fill(null).map(() => Array(numStates).fill(0));
    const vector = Array(numStates).fill(0);
    vector[0] = 1;
    const values = Array(numStates).fill(0);
    setTransitionMatrix(matrix);
    setInitialVector(vector);
    setInitialValues(values);
    setAbsorbingStates([]);
    setMatrixInitialized(true);
  };

  const updateTransitionMatrix = (i, j, value) => {
    const newMatrix = transitionMatrix.map(row => [...row]);
    newMatrix[i][j] = parseFloat(value) || 0;
    setTransitionMatrix(newMatrix);
  };

  const updateInitialVector = (i, value) => {
    const newVector = [...initialVector];
    newVector[i] = parseFloat(value) || 0;
    setInitialVector(newVector);
  };

  const updateInitialValues = (i, value) => {
    const newValues = [...initialValues];
    newValues[i] = parseFloat(value) || 0;
    setInitialValues(newValues);
  };

  const toggleAbsorbingState = (i) => {
    setAbsorbingStates(prev => prev.includes(i) ? prev.filter(s => s !== i) : [...prev, i]);
  };

  const validateRowSum = (rowIndex) => {
    const sum = transitionMatrix[rowIndex].reduce((a, b) => a + b, 0);
    return Math.abs(sum - 1) < 0.0001;
  };

  const validateInitialVector = () => {
    const sum = initialVector.reduce((a, b) => a + b, 0);
    return Math.abs(sum - 1) < 0.0001;
  };

  const multiplyMatrices = (a, b) => {
    const result = Array(a.length).fill(null).map(() => Array(b[0].length).fill(0));
    for (let i = 0; i < a.length; i++) {
      for (let j = 0; j < b[0].length; j++) {
        for (let k = 0; k < a[0].length; k++) {
          result[i][j] += a[i][k] * b[k][j];
        }
      }
    }
    return result;
  };

  const invertMatrix = (matrix) => {
    const n = matrix.length;
    const augmented = matrix.map((row, i) => [...row, ...Array(n).fill(0).map((_, j) => (i === j ? 1 : 0))]);
    for (let i = 0; i < n; i++) {
      let maxRow = i;
      for (let k = i + 1; k < n; k++) {
        if (Math.abs(augmented[k][i]) > Math.abs(augmented[maxRow][i])) maxRow = k;
      }
      const temp = augmented[i];
      augmented[i] = augmented[maxRow];
      augmented[maxRow] = temp;
      const pivot = augmented[i][i];
      if (Math.abs(pivot) < 1e-10) return null;
      for (let j = 0; j < 2 * n; j++) augmented[i][j] /= pivot;
      for (let k = 0; k < n; k++) {
        if (k !== i) {
          const factor = augmented[k][i];
          for (let j = 0; j < 2 * n; j++) augmented[k][j] -= factor * augmented[i][j];
        }
      }
    }
    return augmented.map(row => row.slice(n));
  };

  const markovResults = useMemo(() => {
    if (!matrixInitialized) return null;
    for (let i = 0; i < numStates; i++) {
      if (!validateRowSum(i)) return null;
    }
    if (markovType === 'absorbing' && absorbingStates.length > 0) {
      const transientStates = Array(numStates).fill(0).map((_, i) => i).filter(i => !absorbingStates.includes(i));
      const absorbingStatesList = absorbingStates.slice().sort((a, b) => a - b);
      if (transientStates.length === 0) return { type: 'error', message: 'Debe haber al menos un estado transitorio' };
      const Q = transientStates.map(i => transientStates.map(j => transitionMatrix[i][j]));
      const R = transientStates.map(i => absorbingStatesList.map(j => transitionMatrix[i][j]));
      const IQ = Q.map((row, i) => row.map((val, j) => (i === j ? 1 : 0) - val));
      const N = invertMatrix(IQ);
      if (!N) return { type: 'error', message: 'No se pudo calcular la matriz fundamental' };
      const B = multiplyMatrices(N, R);
      const totalInitialValue = initialValues.reduce((sum, val) => sum + val, 0);
      let absorption = null;
      if (totalInitialValue > 0) {
        const transientValues = transientStates.map(i => initialValues[i]);
        absorption = absorbingStatesList.map((absState, j) => {
          let total = 0;
          for (let i = 0; i < transientStates.length; i++) {
            total += transientValues[i] * B[i][j];
          }
          return total;
        });
      }
      return { type: 'absorbing', transientStates, absorbingStates: absorbingStatesList, N, B, absorption, totalInitialValue };
    }
    if (useInitialVector) {
      if (!validateInitialVector()) return null;
      const results = [initialVector];
      for (let p = 1; p <= numPeriods; p++) {
        const stateVector = initialVector.map((_, i) => {
          let sum = 0;
          for (let j = 0; j < numStates; j++) {
            sum += results[p - 1][j] * transitionMatrix[j][i];
          }
          return sum;
        });
        results.push(stateVector);
      }
      return { type: 'vector', data: results };
    } else {
      const results = [transitionMatrix];
      let currentMatrix = transitionMatrix;
      for (let p = 1; p <= numPeriods; p++) {
        const newMatrix = multiplyMatrices(currentMatrix, transitionMatrix);
        results.push(newMatrix);
        currentMatrix = newMatrix;
      }
      return { type: 'matrix', data: results };
    }
  }, [transitionMatrix, initialVector, initialValues, numPeriods, matrixInitialized, numStates, useInitialVector, markovType, absorbingStates]);

  const factorial = (n) => n <= 1 ? 1 : n * factorial(n - 1);

  const queueResults = useMemo(() => {
    if (queueModel === 'mm1') {
      const rho = lambda / mu;
      if (rho >= 1) return { error: 'Sistema inestable' };
      return { rho, L: rho / (1 - rho), Lq: (rho * rho) / (1 - rho), W: 1 / (mu - lambda), Wq: lambda / (mu * (mu - lambda)), P0: 1 - rho };
    } else if (queueModel === 'mmc') {
      const rho = lambda / (numServers * mu);
      if (rho >= 1) return { error: 'Sistema inestable' };
      const a = lambda / mu;
      let P0 = 0;
      for (let n = 0; n < numServers; n++) P0 += Math.pow(a, n) / factorial(n);
      P0 += (Math.pow(a, numServers) / factorial(numServers)) * (1 / (1 - rho));
      P0 = 1 / P0;
      const Lq = (P0 * Math.pow(a, numServers) * rho) / (factorial(numServers) * Math.pow(1 - rho, 2));
      return { rho, L: Lq + a, Lq, W: (Lq / lambda) + (1 / mu), Wq: Lq / lambda, P0 };
    } else if (queueModel === 'mmck') {
      const a = lambda / mu;
      let P0 = 0;
      for (let n = 0; n < numServers; n++) P0 += Math.pow(a, n) / factorial(n);
      let sumTerm = 0;
      for (let n = numServers; n <= systemCapacity; n++) {
        sumTerm += Math.pow(a, n) / (factorial(numServers) * Math.pow(numServers, n - numServers));
      }
      P0 = 1 / (P0 + sumTerm);
      let Lq = 0;
      for (let n = numServers; n <= systemCapacity; n++) {
        const Pn = (Math.pow(a, n) * P0) / (factorial(numServers) * Math.pow(numServers, n - numServers));
        Lq += (n - numServers) * Pn;
      }
      const lambdaEff = lambda * (1 - (Math.pow(a, systemCapacity) * P0) / (factorial(numServers) * Math.pow(numServers, systemCapacity - numServers)));
      return { rho: lambda / (numServers * mu), L: Lq + (lambdaEff / mu), Lq, W: Lq / lambdaEff + 1 / mu, Wq: Lq / lambdaEff, P0 };
    }
    return null;
  }, [queueModel, lambda, mu, numServers, systemCapacity]);

  if (!mainSelection) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold text-center mb-12 text-indigo-900">Calculadora de Modelos Estocásticos</h1>
          <div className="grid md:grid-cols-2 gap-6">
            <button onClick={() => setMainSelection('markov')} className="bg-white p-8 rounded-2xl shadow-lg hover:shadow-xl transition-all">
              <Network className="w-16 h-16 mx-auto mb-4 text-indigo-600" />
              <h2 className="text-2xl font-bold text-gray-800 mb-2">Cadenas de Markov</h2>
              <p className="text-gray-600">Análisis de procesos estocásticos</p>
            </button>
            <button onClick={() => setMainSelection('queue')} className="bg-white p-8 rounded-2xl shadow-lg hover:shadow-xl transition-all">
              <Clock className="w-16 h-16 mx-auto mb-4 text-purple-600" />
              <h2 className="text-2xl font-bold text-gray-800 mb-2">Teoría de Colas</h2>
              <p className="text-gray-600">Modelos de sistemas de espera</p>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (mainSelection === 'markov' && !markovType) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
        <div className="max-w-4xl mx-auto">
          <button onClick={() => setMainSelection(null)} className="mb-6 text-indigo-600 hover:text-indigo-800 font-medium">← Volver</button>
          <h1 className="text-3xl font-bold mb-8 text-indigo-900">Tipo de cadena</h1>
          <div className="grid md:grid-cols-2 gap-6">
            <button onClick={() => setMarkovType('absorbing')} className="bg-white p-8 rounded-2xl shadow-lg hover:shadow-xl transition-all">
              <h2 className="text-xl font-bold text-gray-800 mb-2">Estados Absorbentes</h2>
              <p className="text-gray-600">Cadenas con estados finales</p>
            </button>
            <button onClick={() => setMarkovType('regular')} className="bg-white p-8 rounded-2xl shadow-lg hover:shadow-xl transition-all">
              <h2 className="text-xl font-bold text-gray-800 mb-2">Estados Regulares</h2>
              <p className="text-gray-600">Cadenas ergódicas</p>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (mainSelection === 'queue' && !queueModel) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-100 p-8">
        <div className="max-w-4xl mx-auto">
          <button onClick={() => setMainSelection(null)} className="mb-6 text-purple-600 hover:text-purple-800 font-medium">← Volver</button>
          <h1 className="text-3xl font-bold mb-8 text-purple-900">Modelo de cola</h1>
          <div className="grid md:grid-cols-3 gap-6">
            <button onClick={() => setQueueModel('mm1')} className="bg-white p-8 rounded-2xl shadow-lg hover:shadow-xl transition-all">
              <h2 className="text-xl font-bold text-gray-800 mb-2">M/M/1</h2>
              <p className="text-gray-600">Un servidor</p>
            </button>
            <button onClick={() => setQueueModel('mmc')} className="bg-white p-8 rounded-2xl shadow-lg hover:shadow-xl transition-all">
              <h2 className="text-xl font-bold text-gray-800 mb-2">M/M/c</h2>
              <p className="text-gray-600">Múltiples servidores</p>
            </button>
            <button onClick={() => setQueueModel('mmck')} className="bg-white p-8 rounded-2xl shadow-lg hover:shadow-xl transition-all">
              <h2 className="text-xl font-bold text-gray-800 mb-2">M/M/c/K</h2>
              <p className="text-gray-600">Capacidad limitada</p>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (mainSelection === 'queue' && queueModel) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-100 p-8">
        <div className="max-w-6xl mx-auto">
          <button onClick={() => setQueueModel(null)} className="mb-6 text-purple-600 hover:text-purple-800 font-medium">← Volver</button>
          <h1 className="text-3xl font-bold mb-8 text-purple-900">Modelo {queueModel.toUpperCase()}</h1>

          <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
            <h2 className="text-xl font-bold mb-4">Parámetros</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Lambda (λ)</label>
                <input type="number" step="0.1" value={lambda} onChange={(e) => setLambda(parseFloat(e.target.value) || 0)} className="w-full px-4 py-2 border rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Mu (μ)</label>
                <input type="number" step="0.1" value={mu} onChange={(e) => setMu(parseFloat(e.target.value) || 0)} className="w-full px-4 py-2 border rounded-lg" />
              </div>
              {(queueModel === 'mmc' || queueModel === 'mmck') && (
                <div>
                  <label className="block text-sm font-medium mb-2">Servidores (c)</label>
                  <input type="number" min="1" value={numServers} onChange={(e) => setNumServers(parseInt(e.target.value) || 1)} className="w-full px-4 py-2 border rounded-lg" />
                </div>
              )}
              {queueModel === 'mmck' && (
                <div>
                  <label className="block text-sm font-medium mb-2">Capacidad (K)</label>
                  <input type="number" min={numServers} value={systemCapacity} onChange={(e) => setSystemCapacity(parseInt(e.target.value) || numServers)} className="w-full px-4 py-2 border rounded-lg" />
                </div>
              )}
            </div>
          </div>

          {queueResults && !queueResults.error && (
            <>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                <div className="bg-white rounded-xl shadow p-6">
                  <div className="text-sm text-gray-600 mb-1">Utilización (ρ)</div>
                  <div className="text-3xl font-bold text-purple-600">{queueResults.rho.toFixed(4)}</div>
                </div>
                <div className="bg-white rounded-xl shadow p-6">
                  <div className="text-sm text-gray-600 mb-1">En sistema (L)</div>
                  <div className="text-3xl font-bold text-blue-600">{queueResults.L.toFixed(4)}</div>
                </div>
                <div className="bg-white rounded-xl shadow p-6">
                  <div className="text-sm text-gray-600 mb-1">En cola (Lq)</div>
                  <div className="text-3xl font-bold text-indigo-600">{queueResults.Lq.toFixed(4)}</div>
                </div>
                <div className="bg-white rounded-xl shadow p-6">
                  <div className="text-sm text-gray-600 mb-1">Tiempo sistema (W)</div>
                  <div className="text-3xl font-bold text-green-600">{queueResults.W.toFixed(4)}</div>
                </div>
                <div className="bg-white rounded-xl shadow p-6">
                  <div className="text-sm text-gray-600 mb-1">Tiempo cola (Wq)</div>
                  <div className="text-3xl font-bold text-teal-600">{queueResults.Wq.toFixed(4)}</div>
                </div>
                <div className="bg-white rounded-xl shadow p-6">
                  <div className="text-sm text-gray-600 mb-1">Vacío (P₀)</div>
                  <div className="text-3xl font-bold text-pink-600">{queueResults.P0.toFixed(4)}</div>
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-lg p-6">
                <h2 className="text-xl font-bold mb-4">Gráfica</h2>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={[
                    { name: 'L', value: queueResults.L },
                    { name: 'Lq', value: queueResults.Lq },
                    { name: 'W', value: queueResults.W },
                    { name: 'Wq', value: queueResults.Wq },
                    { name: 'ρ', value: queueResults.rho },
                    { name: 'P₀', value: queueResults.P0 }
                  ]}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="value" fill="#8b5cf6" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </>
          )}

          {queueResults && queueResults.error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-6">
              <div className="flex items-center gap-2 text-red-800">
                <AlertCircle />
                <span className="font-medium">{queueResults.error}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
      <div className="max-w-6xl mx-auto">
        <button onClick={() => setMarkovType(null)} className="mb-6 text-indigo-600 hover:text-indigo-800 font-medium">← Volver</button>
        <h1 className="text-3xl font-bold mb-8 text-indigo-900">
          {markovType === 'absorbing' ? 'Estados Absorbentes' : 'Estados Regulares'}
        </h1>

        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <h2 className="text-xl font-bold mb-4">Configuración</h2>
          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Estados</label>
              <input type="number" min="2" max="10" value={numStates} onChange={(e) => { setNumStates(parseInt(e.target.value) || 2); setMatrixInitialized(false); }} className="w-full px-4 py-2 border rounded-lg" />
            </div>
            {markovType !== 'absorbing' && (
              <div>
                <label className="block text-sm font-medium mb-2">Períodos</label>
                <input type="number" min="1" max="20" value={numPeriods} onChange={(e) => setNumPeriods(parseInt(e.target.value) || 1)} className="w-full px-4 py-2 border rounded-lg" />
              </div>
            )}
            <div className="flex items-end">
              <button onClick={initializeMarkovMatrices} className="w-full bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700">Inicializar</button>
            </div>
          </div>
        </div>

        {matrixInitialized && (
          <>
            {markovType === 'absorbing' && (
              <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
                <h2 className="text-xl font-bold mb-4">Estados Absorbentes</h2>
                <div className="flex gap-2 flex-wrap">
                  {Array(numStates).fill(0).map((_, i) => (
                    <button key={i} onClick={() => toggleAbsorbingState(i)} className={`px-4 py-2 rounded-lg font-medium ${absorbingStates.includes(i) ? 'bg-red-500 text-white' : 'bg-gray-200 text-gray-700'}`}>
                      Estado {i + 1}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {markovType === 'absorbing' && absorbingStates.length > 0 && (
              <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
                <h2 className="text-xl font-bold mb-4">Valores Iniciales</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {Array(numStates).fill(0).map((_, i) => {
                    if (absorbingStates.includes(i)) return null;
                    return (
                      <div key={i}>
                        <label className="block text-xs mb-1 font-medium">Estado {i + 1}</label>
                        <input type="number" step="0.01" value={initialValues[i]} onChange={(e) => updateInitialValues(i, e.target.value)} className="w-full px-3 py-2 border rounded-lg" />
                      </div>
                    );
                  })}
                </div>
                <div className="mt-3 text-sm text-gray-600">
                  Total: <span className="font-bold">{initialValues.reduce((a, b) => a + b, 0).toLocaleString()}</span>
                </div>
              </div>
            )}

            {markovType !== 'absorbing' && (
              <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={useInitialVector} onChange={(e) => setUseInitialVector(e.target.checked)} className="w-5 h-5" />
                  <span className="font-medium">Usar vector inicial</span>
                </label>
              </div>
            )}

            {useInitialVector && markovType !== 'absorbing' && (
              <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
                <h2 className="text-xl font-bold mb-4">Vector Inicial</h2>
                <div className="flex gap-2 mb-2">
                  {initialVector.map((val, i) => (
                    <div key={i} className="flex-1">
                      <label className="block text-xs mb-1 font-medium">Estado {i + 1}</label>
                      <input type="number" step="0.01" value={val} onChange={(e) => updateInitialVector(i, e.target.value)} className="w-full px-2 py-1 border rounded" />
                    </div>
                  ))}
                </div>
                {!validateInitialVector() && (
                  <div className="flex items-center gap-2 text-red-600 text-sm mt-2">
                    <AlertCircle size={16} />
                    Suma debe ser 1
                  </div>
                )}
              </div>
            )}

            <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
              <h2 className="text-xl font-bold mb-4">Matriz de Transición</h2>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      <th className="p-2 border"></th>
                      {Array(numStates).fill(0).map((_, i) => (
                        <th key={i} className="p-2 text-sm font-medium border bg-gray-50">Estado {i + 1}</th>
                      ))}
                      <th className="p-2 text-sm font-medium border bg-gray-50">Suma</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transitionMatrix.map((row, i) => (
                      <tr key={i}>
                        <td className="p-2 font-medium border bg-gray-50">Estado {i + 1}</td>
                        {row.map((val, j) => (
                          <td key={j} className="p-1 border text-center">
                            <input type="number" step="0.01" value={val} onChange={(e) => updateTransitionMatrix(i, j, e.target.value)} disabled={absorbingStates.includes(i) && i !== j} className="w-20 px-2 py-1 border rounded text-center" />
                          </td>
                        ))}
                        <td className="p-2 text-center border">
                          <span className={validateRowSum(i) ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>{row.reduce((a, b) => a + b, 0).toFixed(3)}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {markovResults && markovResults.type === 'error' && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-6">
                <div className="flex items-center gap-2 text-red-800">
                  <AlertCircle />
                  <span className="font-medium">{markovResults.message}</span>
                </div>
              </div>
            )}

            {markovResults && markovResults.type === 'absorbing' && (
              <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
                <h2 className="text-xl font-bold mb-6">Resultados</h2>
                
                <div className="mb-6">
                  <h3 className="font-medium mb-3">Matriz Fundamental (N)</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="p-2 border">Desde / A</th>
                          {markovResults.transientStates.map(s => (
                            <th key={s} className="p-2 text-center border">E{s + 1}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {markovResults.N.map((row, i) => (
                          <tr key={i}>
                            <td className="p-2 font-medium border bg-gray-50">E{markovResults.transientStates[i] + 1}</td>
                            {row.map((val, j) => (
                              <td key={j} className="p-2 text-center border">{val.toFixed(4)}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="mb-6">
                  <h3 className="font-medium mb-3">Matriz de Absorción (B)</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="p-2 border">Desde / A</th>
                          {markovResults.absorbingStates.map(s => (
                            <th key={s} className="p-2 text-center border">E{s + 1}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {markovResults.B.map((row, i) => (
                          <tr key={i}>
                            <td className="p-2 font-medium border bg-gray-50">E{markovResults.transientStates[i] + 1}</td>
                            {row.map((val, j) => (
                              <td key={j} className="p-2 text-center border">
                                {val.toFixed(4)}<br />
                                <span className="text-xs text-gray-500">({(val * 100).toFixed(2)}%)</span>
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {markovResults.absorption && markovResults.totalInitialValue > 0 && (
                  <>
                    <div className="mb-6">
                      <h3 className="font-medium mb-3">Distribución Final</h3>
                      <div className="grid md:grid-cols-3 gap-4">
                        {markovResults.absorbingStates.map((state, i) => (
                          <div key={state} className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl p-6">
                            <div className="text-sm text-gray-600 mb-1">Estado {state + 1}</div>
                            <div className="text-3xl font-bold text-indigo-600">{markovResults.absorption[i].toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                            <div className="text-sm text-gray-600 mt-1">{((markovResults.absorption[i] / markovResults.totalInitialValue) * 100).toFixed(2)}%</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={markovResults.absorbingStates.map((state, i) => ({
                            name: `Estado ${state + 1}`,
                            value: markovResults.absorption[i]
                          }))}
                          cx="50%"
                          cy="50%"
                          label={(e) => `${e.name}: ${((e.value / markovResults.totalInitialValue) * 100).toFixed(1)}%`}
                          outerRadius={100}
                          dataKey="value"
                        >
                          {markovResults.absorbingStates.map((_, i) => (
                            <Cell key={i} fill={`hsl(${(i * 360) / markovResults.absorbingStates.length}, 70%, 50%)`} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </>
                )}
              </div>
            )}

            {markovResults && markovResults.type === 'vector' && (
              <div className="bg-white rounded-2xl shadow-lg p-6">
                <h2 className="text-xl font-bold mb-4">Resultados</h2>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={markovResults.data.map((states, period) => ({
                    period,
                    ...states.reduce((acc, val, i) => ({...acc, [`Estado ${i + 1}`]: val}), {})
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="period" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    {Array(numStates).fill(0).map((_, i) => (
                      <Line key={i} type="monotone" dataKey={`Estado ${i + 1}`} stroke={`hsl(${(i * 360) / numStates}, 70%, 50%)`} strokeWidth={2} />
                    ))}
                  </LineChart>
                </ResponsiveContainer>

                <div className="mt-6">
                  <h3 className="font-medium mb-3">Período Final ({numPeriods})</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={markovResults.data[numPeriods].map((prob, i) => ({
                          name: `Estado ${i + 1}`,
                          value: prob
                        }))}
                        cx="50%"
                        cy="50%"
                        label={(e) => `${e.name}: ${(e.value * 100).toFixed(1)}%`}
                        outerRadius={100}
                        dataKey="value"
                      >
                        {markovResults.data[numPeriods].map((_, i) => (
                          <Cell key={i} fill={`hsl(${(i * 360) / numStates}, 70%, 50%)`} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v) => `${(v * 100).toFixed(2)}%`} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="mt-6 overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="p-2 border">Período</th>
                        {Array(numStates).fill(0).map((_, i) => (
                          <th key={i} className="p-2 border text-right">E{i + 1}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {markovResults.data.map((states, period) => (
                        <tr key={period} className="border-b">
                          <td className="p-2 font-medium border">{period}</td>
                          {states.map((prob, i) => (
                            <td key={i} className="p-2 text-right border">
                              {prob.toFixed(4)}
                              {period === numPeriods && (
                                <span className="text-xs text-gray-500 ml-1">({(prob * 100).toFixed(2)}%)</span>
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {markovResults && markovResults.type === 'matrix' && (
              <div className="bg-white rounded-2xl shadow-lg p-6">
                <h2 className="text-xl font-bold mb-4">Potencias de Matriz</h2>
                {markovResults.data.map((matrix, period) => (
                  <div key={period} className="mb-6">
                    <h3 className="font-medium mb-2">
                      {period === 0 ? 'Matriz Original (P)' : `Período ${period} (P^${period})`}
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm border-collapse">
                        <thead>
                          <tr className="bg-gray-50">
                            <th className="p-2 border">Desde/Hacia</th>
                            {Array(numStates).fill(0).map((_, i) => (
                              <th key={i} className="p-2 text-center border">E{i + 1}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {matrix.map((row, i) => (
                            <tr key={i}>
                              <td className="p-2 font-medium border bg-gray-50">E{i + 1}</td>
                              {row.map((val, j) => (
                                <td key={j} className="p-2 text-center border">
                                  {val.toFixed(4)}
                                  {period === numPeriods && (
                                    <span className="text-xs text-gray-500 block">({(val * 100).toFixed(2)}%)</span>
                                  )}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default App;