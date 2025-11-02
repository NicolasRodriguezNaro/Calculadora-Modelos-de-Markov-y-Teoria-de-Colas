import React, { useState, useMemo } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Calculator, Network, Clock, ArrowRight, AlertCircle, BarChart3 } from 'lucide-react';

const App = () => {
  const [mainSelection, setMainSelection] = useState(null);
  const [markovType, setMarkovType] = useState(null);
  const [queueModel, setQueueModel] = useState(null);

  // Markov states
  const [numStates, setNumStates] = useState(3);
  const [numPeriods, setNumPeriods] = useState(5);
  const [transitionMatrix, setTransitionMatrix] = useState([]);
  const [initialVector, setInitialVector] = useState([]);
  const [absorbingStates, setAbsorbingStates] = useState([]);
  const [matrixInitialized, setMatrixInitialized] = useState(false);

  // Queue theory states
  const [lambda, setLambda] = useState(5);
  const [mu, setMu] = useState(8);
  const [numServers, setNumServers] = useState(1);
  const [systemCapacity, setSystemCapacity] = useState(10);

  const initializeMarkovMatrices = () => {
    const matrix = Array(numStates).fill(null).map(() => 
      Array(numStates).fill(0)
    );
    const vector = Array(numStates).fill(0);
    vector[0] = 1;
    setTransitionMatrix(matrix);
    setInitialVector(vector);
    setAbsorbingStates([]);
    setMatrixInitialized(true);
  };

  const updateTransitionMatrix = (i, j, value) => {
    const newMatrix = [...transitionMatrix];
    newMatrix[i][j] = parseFloat(value) || 0;
    setTransitionMatrix(newMatrix);
  };

  const updateInitialVector = (i, value) => {
    const newVector = [...initialVector];
    newVector[i] = parseFloat(value) || 0;
    setInitialVector(newVector);
  };

  const toggleAbsorbingState = (i) => {
    setAbsorbingStates(prev => 
      prev.includes(i) ? prev.filter(s => s !== i) : [...prev, i]
    );
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
    const result = Array(a.length).fill(null).map(() => 
      Array(b[0].length).fill(0)
    );
    for (let i = 0; i < a.length; i++) {
      for (let j = 0; j < b[0].length; j++) {
        for (let k = 0; k < a[0].length; k++) {
          result[i][j] += a[i][k] * b[k][j];
        }
      }
    }
    return result;
  };

  const markovResults = useMemo(() => {
    if (!matrixInitialized || !validateInitialVector()) return null;

    for (let i = 0; i < numStates; i++) {
      if (!validateRowSum(i)) return null;
    }

    const results = [initialVector];
    let currentMatrix = transitionMatrix;

    for (let p = 1; p <= numPeriods; p++) {
      const stateVector = initialVector.map((_, i) => 
        transitionMatrix[0].reduce((sum, _, j) => 
          sum + results[p - 1][j] * transitionMatrix[j][i], 0
        )
      );
      results.push(stateVector);
    }

    return results;
  }, [transitionMatrix, initialVector, numPeriods, matrixInitialized, numStates]);

  const factorial = (n) => {
    if (n <= 1) return 1;
    return n * factorial(n - 1);
  };

  const queueResults = useMemo(() => {
    if (queueModel === 'mm1') {
      const rho = lambda / mu;
      if (rho >= 1) return { error: 'El sistema es inestable (ρ ≥ 1)' };
      
      return {
        rho,
        L: rho / (1 - rho),
        Lq: (rho * rho) / (1 - rho),
        W: 1 / (mu - lambda),
        Wq: lambda / (mu * (mu - lambda)),
        P0: 1 - rho
      };
    } else if (queueModel === 'mmc') {
      const rho = lambda / (numServers * mu);
      if (rho >= 1) return { error: 'El sistema es inestable (ρ ≥ 1)' };
      
      const a = lambda / mu;
      let P0 = 0;
      for (let n = 0; n < numServers; n++) {
        P0 += Math.pow(a, n) / factorial(n);
      }
      P0 += (Math.pow(a, numServers) / factorial(numServers)) * (1 / (1 - rho));
      P0 = 1 / P0;

      const Lq = (P0 * Math.pow(a, numServers) * rho) / (factorial(numServers) * Math.pow(1 - rho, 2));
      const L = Lq + a;
      const Wq = Lq / lambda;
      const W = Wq + 1 / mu;

      return { rho, L, Lq, W, Wq, P0 };
    } else if (queueModel === 'mmck') {
      const rho = lambda / (numServers * mu);
      const a = lambda / mu;
      
      let P0 = 0;
      for (let n = 0; n < numServers; n++) {
        P0 += Math.pow(a, n) / factorial(n);
      }
      
      let sumTerm = 0;
      for (let n = numServers; n <= systemCapacity; n++) {
        sumTerm += Math.pow(a, n) / (factorial(numServers) * Math.pow(numServers, n - numServers));
      }
      P0 += sumTerm;
      P0 = 1 / P0;

      let Lq = 0;
      for (let n = numServers; n <= systemCapacity; n++) {
        const Pn = (Math.pow(a, n) * P0) / (factorial(numServers) * Math.pow(numServers, n - numServers));
        Lq += (n - numServers) * Pn;
      }

      const lambdaEff = lambda * (1 - (Math.pow(a, systemCapacity) * P0) / (factorial(numServers) * Math.pow(numServers, systemCapacity - numServers)));
      const L = Lq + (lambdaEff / mu);
      const Wq = Lq / lambdaEff;
      const W = L / lambdaEff;

      return { rho, L, Lq, W, Wq, P0, lambdaEff };
    }
    return null;
  }, [queueModel, lambda, mu, numServers, systemCapacity]);

  if (!mainSelection) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold text-center mb-12 text-indigo-900">
            Calculadora de Modelos Estocásticos
          </h1>
          <div className="grid md:grid-cols-2 gap-6">
            <button
              onClick={() => setMainSelection('markov')}
              className="bg-white p-8 rounded-2xl shadow-lg hover:shadow-xl transition-all transform hover:scale-105"
            >
              <Network className="w-16 h-16 mx-auto mb-4 text-indigo-600" />
              <h2 className="text-2xl font-bold text-gray-800 mb-2">Cadenas de Markov</h2>
              <p className="text-gray-600">Análisis de procesos estocásticos con estados discretos</p>
            </button>
            <button
              onClick={() => setMainSelection('queue')}
              className="bg-white p-8 rounded-2xl shadow-lg hover:shadow-xl transition-all transform hover:scale-105"
            >
              <Clock className="w-16 h-16 mx-auto mb-4 text-purple-600" />
              <h2 className="text-2xl font-bold text-gray-800 mb-2">Teoría de Colas</h2>
              <p className="text-gray-600">Modelos de sistemas de espera y servicio</p>
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
          <button
            onClick={() => setMainSelection(null)}
            className="mb-6 text-indigo-600 hover:text-indigo-800 font-medium"
          >
            ← Volver
          </button>
          <h1 className="text-3xl font-bold mb-8 text-indigo-900">Selecciona el tipo de cadena</h1>
          <div className="grid md:grid-cols-2 gap-6">
            <button
              onClick={() => setMarkovType('absorbing')}
              className="bg-white p-8 rounded-2xl shadow-lg hover:shadow-xl transition-all"
            >
              <h2 className="text-xl font-bold text-gray-800 mb-2">Estados Absorbentes</h2>
              <p className="text-gray-600">Cadenas con estados finales que no permiten transiciones</p>
            </button>
            <button
              onClick={() => setMarkovType('regular')}
              className="bg-white p-8 rounded-2xl shadow-lg hover:shadow-xl transition-all"
            >
              <h2 className="text-xl font-bold text-gray-800 mb-2">Estados Regulares</h2>
              <p className="text-gray-600">Cadenas ergódicas con distribución estacionaria</p>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (mainSelection === 'markov' && markovType) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
        <div className="max-w-6xl mx-auto">
          <button
            onClick={() => setMarkovType(null)}
            className="mb-6 text-indigo-600 hover:text-indigo-800 font-medium"
          >
            ← Volver
          </button>
          <h1 className="text-3xl font-bold mb-8 text-indigo-900">
            Cadena de Markov - {markovType === 'absorbing' ? 'Estados Absorbentes' : 'Estados Regulares'}
          </h1>

          <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
            <h2 className="text-xl font-bold mb-4">Configuración</h2>
            <div className="grid md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium mb-2">Número de estados</label>
                <input
                  type="number"
                  min="2"
                  max="10"
                  value={numStates}
                  onChange={(e) => {
                    setNumStates(parseInt(e.target.value) || 2);
                    setMatrixInitialized(false);
                  }}
                  className="w-full px-4 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Número de períodos</label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={numPeriods}
                  onChange={(e) => setNumPeriods(parseInt(e.target.value) || 1)}
                  className="w-full px-4 py-2 border rounded-lg"
                />
              </div>
              <div className="flex items-end">
                <button
                  onClick={initializeMarkovMatrices}
                  className="w-full bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700"
                >
                  Inicializar Matrices
                </button>
              </div>
            </div>
          </div>

          {matrixInitialized && (
            <>
              <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
                <h2 className="text-xl font-bold mb-4">Vector de Estado Inicial</h2>
                <div className="flex gap-2 mb-2">
                  {initialVector.map((val, i) => (
                    <div key={i} className="flex-1">
                      <label className="block text-xs mb-1">E{i}</label>
                      <input
                        type="number"
                        step="0.01"
                        value={val}
                        onChange={(e) => updateInitialVector(i, e.target.value)}
                        className="w-full px-2 py-1 border rounded"
                      />
                    </div>
                  ))}
                </div>
                {!validateInitialVector() && (
                  <div className="flex items-center gap-2 text-red-600 text-sm mt-2">
                    <AlertCircle size={16} />
                    La suma debe ser igual a 1
                  </div>
                )}
              </div>

              {markovType === 'absorbing' && (
                <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
                  <h2 className="text-xl font-bold mb-4">Estados Absorbentes</h2>
                  <div className="flex gap-2 flex-wrap">
                    {Array(numStates).fill(0).map((_, i) => (
                      <button
                        key={i}
                        onClick={() => toggleAbsorbingState(i)}
                        className={`px-4 py-2 rounded-lg font-medium ${
                          absorbingStates.includes(i)
                            ? 'bg-red-500 text-white'
                            : 'bg-gray-200 text-gray-700'
                        }`}
                      >
                        Estado {i}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
                <h2 className="text-xl font-bold mb-4">Matriz de Transición</h2>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr>
                        <th className="p-2"></th>
                        {Array(numStates).fill(0).map((_, i) => (
                          <th key={i} className="p-2 text-sm font-medium">E{i}</th>
                        ))}
                        <th className="p-2 text-sm font-medium">Suma</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transitionMatrix.map((row, i) => (
                        <tr key={i}>
                          <td className="p-2 font-medium">E{i}</td>
                          {row.map((val, j) => (
                            <td key={j} className="p-1">
                              <input
                                type="number"
                                step="0.01"
                                value={val}
                                onChange={(e) => updateTransitionMatrix(i, j, e.target.value)}
                                disabled={absorbingStates.includes(i) && i !== j}
                                className="w-16 px-2 py-1 border rounded text-center"
                              />
                            </td>
                          ))}
                          <td className="p-2 text-center">
                            <span className={validateRowSum(i) ? 'text-green-600' : 'text-red-600'}>
                              {row.reduce((a, b) => a + b, 0).toFixed(3)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {markovResults && (
                <div className="bg-white rounded-2xl shadow-lg p-6">
                  <h2 className="text-xl font-bold mb-4">Resultados</h2>
                  <div className="mb-6">
                    <h3 className="font-medium mb-2">Evolución de estados</h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={markovResults.map((states, period) => ({
                        period,
                        ...states.reduce((acc, val, i) => ({...acc, [`E${i}`]: val}), {})
                      }))}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="period" label={{ value: 'Período', position: 'insideBottom', offset: -5 }} />
                        <YAxis label={{ value: 'Probabilidad', angle: -90, position: 'insideLeft' }} />
                        <Tooltip />
                        <Legend />
                        {Array(numStates).fill(0).map((_, i) => (
                          <Line
                            key={i}
                            type="monotone"
                            dataKey={`E${i}`}
                            stroke={`hsl(${(i * 360) / numStates}, 70%, 50%)`}
                            strokeWidth={2}
                          />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <div>
                    <h3 className="font-medium mb-2">Tabla de probabilidades</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="p-2 text-left">Período</th>
                            {Array(numStates).fill(0).map((_, i) => (
                              <th key={i} className="p-2 text-right">E{i}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {markovResults.map((states, period) => (
                            <tr key={period} className="border-b">
                              <td className="p-2 font-medium">{period}</td>
                              {states.map((prob, i) => (
                                <td key={i} className="p-2 text-right">{prob.toFixed(4)}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  if (mainSelection === 'queue' && !queueModel) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-100 p-8">
        <div className="max-w-4xl mx-auto">
          <button
            onClick={() => setMainSelection(null)}
            className="mb-6 text-purple-600 hover:text-purple-800 font-medium"
          >
            ← Volver
          </button>
          <h1 className="text-3xl font-bold mb-8 text-purple-900">Selecciona el modelo de cola</h1>
          <div className="grid md:grid-cols-3 gap-6">
            <button
              onClick={() => setQueueModel('mm1')}
              className="bg-white p-8 rounded-2xl shadow-lg hover:shadow-xl transition-all"
            >
              <h2 className="text-xl font-bold text-gray-800 mb-2">M/M/1</h2>
              <p className="text-gray-600">Un servidor, capacidad infinita</p>
            </button>
            <button
              onClick={() => setQueueModel('mmc')}
              className="bg-white p-8 rounded-2xl shadow-lg hover:shadow-xl transition-all"
            >
              <h2 className="text-xl font-bold text-gray-800 mb-2">M/M/c</h2>
              <p className="text-gray-600">Múltiples servidores, capacidad infinita</p>
            </button>
            <button
              onClick={() => setQueueModel('mmck')}
              className="bg-white p-8 rounded-2xl shadow-lg hover:shadow-xl transition-all"
            >
              <h2 className="text-xl font-bold text-gray-800 mb-2">M/M/c/K</h2>
              <p className="text-gray-600">Múltiples servidores, capacidad limitada</p>
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
          <button
            onClick={() => setQueueModel(null)}
            className="mb-6 text-purple-600 hover:text-purple-800 font-medium"
          >
            ← Volver
          </button>
          <h1 className="text-3xl font-bold mb-8 text-purple-900">
            Modelo {queueModel.toUpperCase().replace(/(.)/g, '$1/')}
          </h1>

          <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
            <h2 className="text-xl font-bold mb-4">Parámetros del Sistema</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Tasa de llegada (λ)</label>
                <input
                  type="number"
                  step="0.1"
                  value={lambda}
                  onChange={(e) => setLambda(parseFloat(e.target.value) || 0)}
                  className="w-full px-4 py-2 border rounded-lg"
                />
                <p className="text-xs text-gray-500 mt-1">Clientes/hora</p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Tasa de servicio (μ)</label>
                <input
                  type="number"
                  step="0.1"
                  value={mu}
                  onChange={(e) => setMu(parseFloat(e.target.value) || 0)}
                  className="w-full px-4 py-2 border rounded-lg"
                />
                <p className="text-xs text-gray-500 mt-1">Clientes/hora</p>
              </div>
              {(queueModel === 'mmc' || queueModel === 'mmck') && (
                <div>
                  <label className="block text-sm font-medium mb-2">Número de servidores (c)</label>
                  <input
                    type="number"
                    min="1"
                    value={numServers}
                    onChange={(e) => setNumServers(parseInt(e.target.value) || 1)}
                    className="w-full px-4 py-2 border rounded-lg"
                  />
                </div>
              )}
              {queueModel === 'mmck' && (
                <div>
                  <label className="block text-sm font-medium mb-2">Capacidad del sistema (K)</label>
                  <input
                    type="number"
                    min={numServers}
                    value={systemCapacity}
                    onChange={(e) => setSystemCapacity(parseInt(e.target.value) || numServers)}
                    className="w-full px-4 py-2 border rounded-lg"
                  />
                </div>
              )}
            </div>
          </div>

          {queueResults && !queueResults.error && (
            <>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                <div className="bg-white rounded-xl shadow p-6">
                  <div className="text-sm text-gray-600 mb-1">Factor de utilización (ρ)</div>
                  <div className="text-3xl font-bold text-purple-600">{queueResults.rho.toFixed(4)}</div>
                </div>
                <div className="bg-white rounded-xl shadow p-6">
                  <div className="text-sm text-gray-600 mb-1">Clientes en sistema (L)</div>
                  <div className="text-3xl font-bold text-blue-600">{queueResults.L.toFixed(4)}</div>
                </div>
                <div className="bg-white rounded-xl shadow p-6">
                  <div className="text-sm text-gray-600 mb-1">Clientes en cola (Lq)</div>
                  <div className="text-3xl font-bold text-indigo-600">{queueResults.Lq.toFixed(4)}</div>
                </div>
                <div className="bg-white rounded-xl shadow p-6">
                  <div className="text-sm text-gray-600 mb-1">Tiempo en sistema (W)</div>
                  <div className="text-3xl font-bold text-green-600">{queueResults.W.toFixed(4)}</div>
                  <div className="text-xs text-gray-500">horas</div>
                </div>
                <div className="bg-white rounded-xl shadow p-6">
                  <div className="text-sm text-gray-600 mb-1">Tiempo en cola (Wq)</div>
                  <div className="text-3xl font-bold text-teal-600">{queueResults.Wq.toFixed(4)}</div>
                  <div className="text-xs text-gray-500">horas</div>
                </div>
                <div className="bg-white rounded-xl shadow p-6">
                  <div className="text-sm text-gray-600 mb-1">Prob. sistema vacío (P₀)</div>
                  <div className="text-3xl font-bold text-pink-600">{queueResults.P0.toFixed(4)}</div>
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-lg p-6">
                <h2 className="text-xl font-bold mb-4">Visualización de Métricas</h2>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={[
                    { name: 'L (Sistema)', value: queueResults.L },
                    { name: 'Lq (Cola)', value: queueResults.Lq },
                    { name: 'W (Sistema)', value: queueResults.W },
                    { name: 'Wq (Cola)', value: queueResults.Wq },
                    { name: 'ρ (Utilización)', value: queueResults.rho },
                    { name: 'P₀ (Vacío)', value: queueResults.P0 }
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
              <p className="text-sm text-red-600 mt-2">
                Ajusta los parámetros para que λ {'<'} {queueModel === 'mm1' ? 'μ' : 'c×μ'}
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
};

export default App;