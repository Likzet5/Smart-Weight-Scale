/**
 * Chart rendering for the Strength Training Monitor
 * Supports both Recharts (React) and fallback Canvas rendering
 */
export class ChartRenderer {
  /**
   * Create a chart renderer instance
   * @param {string} containerId - DOM ID of chart container
   */
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    
    // Check if Recharts is available
    this.useRecharts = typeof Recharts !== 'undefined' && 
                        typeof React !== 'undefined' && 
                        typeof ReactDOM !== 'undefined';
    
    // Canvas fallback
    this.canvas = null;
    this.ctx = null;
    
    // Default chart options
    this.options = {
      showTargetLine: false,
      targetForce: 100,
      unit: 'kg',
      maxTime: 10,
      maxForce: 150,
      adaptiveScaling: true
    };
    
    // Initialize renderer
    this._initialize();
  }
  
  /**
   * Initialize the appropriate renderer
   * @private
   */
  _initialize() {
    if (!this.useRecharts) {
      // Create canvas element for fallback
      this.canvas = document.createElement('canvas');
      this.canvas.width = this.container.clientWidth;
      this.canvas.height = this.container.clientHeight;
      this.container.appendChild(this.canvas);
      this.ctx = this.canvas.getContext('2d');
      
      // Listen for resize events
      window.addEventListener('resize', this._handleResize.bind(this));
    }
  }
  
  /**
   * Handle container resize
   * @private
   */
  _handleResize() {
    if (this.canvas) {
      this.canvas.width = this.container.clientWidth;
      this.canvas.height = this.container.clientHeight;
      this.render(this._lastData || []);
    }
  }
  
  /**
   * Set chart options
   * @param {Object} options - Chart options
   */
  setOptions(options) {
    this.options = { ...this.options, ...options };
  }
  
  /**
   * Render force history data on the chart
   * @param {Array} data - Array of {time, force} data points
   */
  render(data) {
    this._lastData = data;
    
    if (this.useRecharts) {
      this._renderWithRecharts(data);
    } else {
      this._renderWithCanvas(data);
    }
  }
  
  /**
   * Calculate the axis limits based on data and settings
   * @param {Array} data - The data points to render
   * @returns {Object} - Axis limits {maxTime, maxForce}
   * @private
   */
  _calculateAxisLimits(data) {
    let maxTime = this.options.maxTime;
    let maxForce = this.options.maxForce;
    
    // If adaptive scaling is enabled, calculate from data
    if (this.options.adaptiveScaling && data.length > 0) {
      // For time axis, take the max time from data or configured max, whichever is larger
      const dataMaxTime = Math.max(...data.map(d => d.time));
      maxTime = Math.max(dataMaxTime + 1, this.options.maxTime); // Add some padding
      
      // For force axis, take the max force from data or configured max, whichever is larger
      // but only if using adaptive scaling
      const dataMaxForce = Math.max(...data.map(d => d.force), 1);
      maxForce = Math.max(dataMaxForce * 1.1, this.options.maxForce); // Add 10% padding
    }
    
    return { maxTime, maxForce };
  }
  
  /**
   * Render chart using Recharts library
   * @param {Array} data - Array of {time, force} data points
   * @private
   */
  _renderWithRecharts(data) {
    const { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, 
            Legend, ReferenceLine } = Recharts;
    
    // Prepare data - ensure time values are fixed to 1 decimal place
    const chartData = data.map(point => ({
      time: parseFloat(point.time.toFixed(1)),
      force: point.force
    }));
    
    // Calculate axis limits
    const { maxTime, maxForce } = this._calculateAxisLimits(data);
    
    // Create Recharts component
    const chart = React.createElement(
      LineChart, 
      { 
        width: this.container.clientWidth,
        height: this.container.clientHeight,
        data: chartData,
        margin: { top: 5, right: 30, left: 20, bottom: 5 }
      },
      React.createElement(CartesianGrid, { strokeDasharray: "3 3" }),
      React.createElement(XAxis, { 
        dataKey: "time",
        type: "number",
        domain: [0, maxTime],
        label: { value: 'Time (seconds)', position: 'insideBottomRight', offset: -5 }
      }),
      React.createElement(YAxis, { 
        domain: [0, maxForce],
        label: { value: `Force (${this.options.unit})`, angle: -90, position: 'insideLeft' }
      }),
      React.createElement(Tooltip, { 
        formatter: (value) => [`${value.toFixed(1)} ${this.options.unit}`, 'Force']
      }),
      React.createElement(Legend),
      React.createElement(
        Line, 
        { 
          type: "monotone", 
          dataKey: "force", 
          stroke: "#3B82F6", 
          dot: true,
          activeDot: { r: 8 }
        }
      ),
      this.options.showTargetLine ? React.createElement(
        ReferenceLine,
        {
          y: this.options.targetForce,
          stroke: "red",
          strokeDasharray: "3 3",
          label: "Target"
        }
      ) : null
    );
    
    // Render chart
    ReactDOM.render(chart, this.container);
  }
  
  /**
   * Render chart using Canvas fallback
   * @param {Array} data - Array of {time, force} data points
   * @private
   */
  _renderWithCanvas(data) {
    const ctx = this.ctx;
    const width = this.canvas.width;
    const height = this.canvas.height;
    
    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    
    // If no data, show empty state
    if (data.length === 0) {
      ctx.fillStyle = '#9CA3AF';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('No data to display. Start recording to see your force graph.', width / 2, height / 2);
      return;
    }
    
    // Chart padding
    const padding = { top: 20, right: 20, bottom: 30, left: 40 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;
    
    // Calculate axis limits
    const { maxTime, maxForce } = this._calculateAxisLimits(data);
    
    // Draw axes
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    
    // X-axis
    ctx.beginPath();
    ctx.moveTo(padding.left, height - padding.bottom);
    ctx.lineTo(width - padding.right, height - padding.bottom);
    ctx.stroke();
    
    // Y-axis
    ctx.beginPath();
    ctx.moveTo(padding.left, padding.top);
    ctx.lineTo(padding.left, height - padding.bottom);
    ctx.stroke();
    
    // X-axis labels
    ctx.fillStyle = '#4B5563';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    const xLabelCount = 5;
    for (let i = 0; i <= xLabelCount; i++) {
      const value = (i / xLabelCount) * maxTime;
      const x = padding.left + (i / xLabelCount) * chartWidth;
      ctx.fillText(value.toFixed(1) + 's', x, height - padding.bottom + 15);
    }
    
    // Y-axis labels
    ctx.textAlign = 'right';
    const yLabelCount = 5;
    for (let i = 0; i <= yLabelCount; i++) {
      const value = (i / yLabelCount) * maxForce;
      const y = height - padding.bottom - (i / yLabelCount) * chartHeight;
      ctx.fillText(value.toFixed(0) + ' ' + this.options.unit, padding.left - 5, y + 3);
    }
    
    // Draw target line if enabled
    if (this.options.showTargetLine) {
      const target = this.options.targetForce;
      const targetY = height - padding.bottom - (target / maxForce) * chartHeight;
      
      ctx.beginPath();
      ctx.setLineDash([5, 5]);
      ctx.strokeStyle = '#EF4444';
      ctx.lineWidth = 2;
      ctx.moveTo(padding.left, targetY);
      ctx.lineTo(width - padding.right, targetY);
      ctx.stroke();
      ctx.setLineDash([]);
      
      // Label for target line
      ctx.fillStyle = '#EF4444';
      ctx.textAlign = 'left';
      ctx.fillText('Target', width - padding.right - 40, targetY - 5);
    }
    
    // Draw data line
    if (data.length > 0) {
      ctx.beginPath();
      ctx.strokeStyle = '#3B82F6';
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';
      
      data.forEach((point, i) => {
        const x = padding.left + (point.time / maxTime) * chartWidth;
        const y = height - padding.bottom - (point.force / maxForce) * chartHeight;
        
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });
      
      ctx.stroke();
      
      // Draw points
      data.forEach(point => {
        const x = padding.left + (point.time / maxTime) * chartWidth;
        const y = height - padding.bottom - (point.force / maxForce) * chartHeight;
        
        ctx.beginPath();
        ctx.fillStyle = '#3B82F6';
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fill();
      });
    }
  }
  
  /**
   * Clear the chart
   */
  clear() {
    if (this.useRecharts) {
      ReactDOM.unmountComponentAtNode(this.container);
    } else if (this.ctx) {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
    this._lastData = [];
  }
}
