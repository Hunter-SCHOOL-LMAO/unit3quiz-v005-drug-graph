import { useState, useEffect, useCallback } from 'react'
import Papa from 'papaparse'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts'
import './App.css'

// Dynamically import Firebase modules
const getFirebaseModules = async () => {
  const [{ db }, firestore] = await Promise.all([
    import('./firebase'),
    import('firebase/firestore')
  ])
  return { db, ...firestore }
}

function App() {
  const [chartData, setChartData] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedMetric, setSelectedMetric] = useState('all')
  const [totalRecords, setTotalRecords] = useState(0)
  
  // Registration modal state
  const [showModal, setShowModal] = useState(false)
  const [email, setEmail] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitMessage, setSubmitMessage] = useState(null)
  const [voteStats, setVoteStats] = useState({ for: 0, against: 0 })
  const [firebaseLoaded, setFirebaseLoaded] = useState(false)

  // Fetch vote stats using dynamic import
  const fetchVoteStats = useCallback(async () => {
    try {
      const { db, collection, getDocs } = await getFirebaseModules()
      const votesRef = collection(db, 'votes')
      const snapshot = await getDocs(votesRef)
      let forCount = 0
      let againstCount = 0
      snapshot.forEach(doc => {
        const data = doc.data()
        if (data.vote === 'for') forCount++
        if (data.vote === 'against') againstCount++
      })
      setVoteStats({ for: forCount, against: againstCount })
      setFirebaseLoaded(true)
    } catch (error) {
      console.error('Error fetching votes:', error)
    }
  }, [])

  // Load Firebase and fetch votes when modal opens
  useEffect(() => {
    if (showModal && !firebaseLoaded) {
      fetchVoteStats()
    }
  }, [showModal, firebaseLoaded, fetchVoteStats])

  useEffect(() => {
    Papa.parse('/Warehouse_and_Retail_Sales.csv', {
      download: true,
      header: true,
      complete: (results) => {
        setTotalRecords(results.data.length)
        
        // Aggregate data by SUPPLIER (warehouse)
        const warehouseData = {}
        
        results.data.forEach(row => {
          const warehouse = row.SUPPLIER
          if (!warehouse || warehouse === '') return
          
          if (!warehouseData[warehouse]) {
            warehouseData[warehouse] = {
              name: warehouse,
              warehouseSales: 0,
              retailSales: 0,
              retailTransfers: 0
            }
          }
          
          warehouseData[warehouse].warehouseSales += parseFloat(row['WAREHOUSE SALES']) || 0
          warehouseData[warehouse].retailSales += parseFloat(row['RETAIL SALES']) || 0
          warehouseData[warehouse].retailTransfers += parseFloat(row['RETAIL TRANSFERS']) || 0
        })
        
        // Convert to array and calculate total, then sort by total sales
        const dataArray = Object.values(warehouseData).map(item => ({
          ...item,
          total: item.warehouseSales + item.retailSales + item.retailTransfers
        }))
        
        // Sort by total sales descending and take top 15
        dataArray.sort((a, b) => b.total - a.total)
        const topWarehouses = dataArray.slice(0, 15)
        
        // Shorten names for display
        const formattedData = topWarehouses.map(item => ({
          ...item,
          shortName: item.name.length > 20 ? item.name.substring(0, 18) + '...' : item.name
        }))
        
        setChartData(formattedData)
        setLoading(false)
      },
      error: (error) => {
        console.error('Error parsing CSV:', error)
        setLoading(false)
      }
    })
  }, [])

  const colors = {
    warehouseSales: '#00d4aa',
    retailSales: '#ff6b9d',
    retailTransfers: '#7c5cff'
  }

  const handleVote = async (voteType) => {
    if (!email || !email.includes('@')) {
      setSubmitMessage({ type: 'error', text: 'Please enter a valid email address' })
      return
    }

    setIsSubmitting(true)
    setSubmitMessage(null)

    try {
      const { db, collection, addDoc, getDocs, query, where } = await getFirebaseModules()
      
      // Check if email has already voted
      const votesRef = collection(db, 'votes')
      const q = query(votesRef, where('email', '==', email.toLowerCase()))
      const existingVotes = await getDocs(q)
      
      if (!existingVotes.empty) {
        setSubmitMessage({ type: 'error', text: 'This email has already voted!' })
        setIsSubmitting(false)
        return
      }

      // Add vote to Firestore
      await addDoc(votesRef, {
        email: email.toLowerCase(),
        vote: voteType,
        timestamp: new Date().toISOString()
      })

      setSubmitMessage({ 
        type: 'success', 
        text: `Vote recorded! You voted "${voteType.toUpperCase()}". Thank you!` 
      })
      setEmail('')
      
      // Refresh vote stats
      await fetchVoteStats()
      
      // Close modal after delay
      setTimeout(() => {
        setShowModal(false)
        setSubmitMessage(null)
      }, 2500)

    } catch (error) {
      console.error('Error submitting vote:', error)
      setSubmitMessage({ 
        type: 'error', 
        text: 'Error submitting vote. Please check Firebase configuration.' 
      })
    }

    setIsSubmitting(false)
  }

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const data = chartData.find(d => d.shortName === label)
      return (
        <div className="custom-tooltip">
          <p className="tooltip-title">{data?.name}</p>
          {payload.map((entry, index) => (
            <p key={index} style={{ color: entry.color }}>
              {entry.name}: {entry.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          ))}
          <p className="tooltip-total">
            Total: {data?.total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
      )
    }
    return null
  }

  if (loading) {
    return (
      <div className="app">
        <div className="loading">
          <div className="spinner"></div>
          <p>Loading sales data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="app">
      {/* Registration Button - Fixed in Corner */}
      <button 
        className="register-btn"
        onClick={() => setShowModal(true)}
      >
        <span className="register-icon">✋</span>
        Vote Now
      </button>

      {/* Registration Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
            
            <div className="modal-header">
              <h2>Cast Your Vote</h2>
              <p>Enter your email and vote for or against the data insights</p>
            </div>

            <div className="vote-stats">
              <div className="vote-stat for">
                <span className="vote-count">{voteStats.for}</span>
                <span className="vote-label">For</span>
              </div>
              <div className="vote-divider">vs</div>
              <div className="vote-stat against">
                <span className="vote-count">{voteStats.against}</span>
                <span className="vote-label">Against</span>
              </div>
            </div>

            <div className="modal-form">
              <div className="input-group">
                <label htmlFor="email">Email Address</label>
                <input
                  type="email"
                  id="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>

              {submitMessage && (
                <div className={`submit-message ${submitMessage.type}`}>
                  {submitMessage.text}
                </div>
              )}

              <div className="vote-buttons">
                <button 
                  className="vote-btn for"
                  onClick={() => handleVote('for')}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? '...' : '👍 FOR'}
                </button>
                <button 
                  className="vote-btn against"
                  onClick={() => handleVote('against')}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? '...' : '👎 AGAINST'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <header className="header">
        <div className="header-glow"></div>
        <h1>Warehouse & Retail Sales</h1>
        <p className="subtitle">Sales Distribution by Warehouse (Top 15)</p>
        <div className="stats">
          <div className="stat-card">
            <span className="stat-number">{totalRecords.toLocaleString()}</span>
            <span className="stat-label">Total Records</span>
          </div>
          <div className="stat-card">
            <span className="stat-number">{chartData.length}</span>
            <span className="stat-label">Warehouses Shown</span>
          </div>
          <div className="stat-card">
            <span className="stat-number">
              {chartData.reduce((sum, d) => sum + d.total, 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </span>
            <span className="stat-label">Total Sales (Top 15)</span>
          </div>
        </div>
      </header>

      <main className="main">
        <div className="controls">
          <button 
            className={`filter-btn ${selectedMetric === 'all' ? 'active' : ''}`}
            onClick={() => setSelectedMetric('all')}
          >
            All Metrics
          </button>
          <button 
            className={`filter-btn ${selectedMetric === 'warehouse' ? 'active' : ''}`}
            onClick={() => setSelectedMetric('warehouse')}
            style={{'--btn-color': colors.warehouseSales}}
          >
            Warehouse Sales
          </button>
          <button 
            className={`filter-btn ${selectedMetric === 'retail' ? 'active' : ''}`}
            onClick={() => setSelectedMetric('retail')}
            style={{'--btn-color': colors.retailSales}}
          >
            Retail Sales
          </button>
          <button 
            className={`filter-btn ${selectedMetric === 'transfers' ? 'active' : ''}`}
            onClick={() => setSelectedMetric('transfers')}
            style={{'--btn-color': colors.retailTransfers}}
          >
            Retail Transfers
          </button>
        </div>

        <div className="chart-container">
          <ResponsiveContainer width="100%" height={500}>
            <BarChart
              data={chartData}
              margin={{ top: 20, right: 30, left: 20, bottom: 120 }}
            >
              <defs>
                <linearGradient id="warehouseGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#00d4aa" stopOpacity={1}/>
                  <stop offset="100%" stopColor="#00a385" stopOpacity={1}/>
                </linearGradient>
                <linearGradient id="retailGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ff6b9d" stopOpacity={1}/>
                  <stop offset="100%" stopColor="#d44a7a" stopOpacity={1}/>
                </linearGradient>
                <linearGradient id="transferGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#7c5cff" stopOpacity={1}/>
                  <stop offset="100%" stopColor="#5a3dd6" stopOpacity={1}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis 
                dataKey="shortName" 
                angle={-45}
                textAnchor="end"
                height={100}
                tick={{ fill: '#a0a0b0', fontSize: 11 }}
                axisLine={{ stroke: 'rgba(255,255,255,0.2)' }}
              />
              <YAxis 
                tick={{ fill: '#a0a0b0' }}
                axisLine={{ stroke: 'rgba(255,255,255,0.2)' }}
                tickFormatter={(value) => value >= 1000 ? `${(value/1000).toFixed(0)}K` : value}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend 
                wrapperStyle={{ paddingTop: '20px' }}
                formatter={(value) => <span style={{ color: '#e0e0e0' }}>{value}</span>}
              />
              {(selectedMetric === 'all' || selectedMetric === 'warehouse') && (
                <Bar 
                  dataKey="warehouseSales" 
                  name="Warehouse Sales" 
                  fill="url(#warehouseGradient)"
                  radius={[4, 4, 0, 0]}
                />
              )}
              {(selectedMetric === 'all' || selectedMetric === 'retail') && (
                <Bar 
                  dataKey="retailSales" 
                  name="Retail Sales" 
                  fill="url(#retailGradient)"
                  radius={[4, 4, 0, 0]}
                />
              )}
              {(selectedMetric === 'all' || selectedMetric === 'transfers') && (
                <Bar 
                  dataKey="retailTransfers" 
                  name="Retail Transfers" 
                  fill="url(#transferGradient)"
                  radius={[4, 4, 0, 0]}
                />
              )}
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="data-table">
          <h2>Top Warehouses by Total Sales</h2>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Warehouse / Supplier</th>
                  <th>Warehouse Sales</th>
                  <th>Retail Sales</th>
                  <th>Retail Transfers</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {chartData.map((row, index) => (
                  <tr key={row.name}>
                    <td className="rank">#{index + 1}</td>
                    <td className="warehouse-name">{row.name}</td>
                    <td style={{ color: colors.warehouseSales }}>{row.warehouseSales.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                    <td style={{ color: colors.retailSales }}>{row.retailSales.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                    <td style={{ color: colors.retailTransfers }}>{row.retailTransfers.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                    <td className="total">{row.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      <footer className="footer">
        <p>Data visualization powered by Recharts • {new Date().getFullYear()}</p>
      </footer>
    </div>
  )
}

export default App
