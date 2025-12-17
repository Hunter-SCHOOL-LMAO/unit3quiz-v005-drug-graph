import { useState, useEffect } from 'react'
import Papa from 'papaparse'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell
} from 'recharts'
import './App.css'

function App() {
  const [chartData, setChartData] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedMetric, setSelectedMetric] = useState('all')
  const [totalRecords, setTotalRecords] = useState(0)

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
