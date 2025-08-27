/**
 * Enhanced dual-axis chart rendering for the Strength Training Monitor
 * Supports visualization of both Force and RFD (Rate of Force Development)
 */
export class DualAxisChartRenderer {
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
    
    // Theme colors
    this.theme = {
      force: '#3B82F6',        // Blue
      rfd: '#8B5CF6',          // Purple
      forceTarget: '#EF4444',  // Red
      rfdTarget: '#DC2626',    // Darker Red
      grid: '#E5E7EB',         // Light Gray
      text: '#1F2937',         // Dark Gray
      background: '#FFFFFF',   // White
      tooltip: '#F3F4F6'       // Light Gray background
    };
    
    // Default chart options
    this.options = {
      showForce: true,
      showRFD: true,
      showForceTargetLine: false,
      showRFDTargetLine: false,
      targetForce: 100,
      targetRFD: 500,
      unit: 'kg',
      maxTime: 10,
      maxForce: 150,
      maxRFD: 1000,
      adaptiveScaling: true,
      smoothCurve: true
    };
    
    // Data containers
    this.forceData = [];
    this.rfdData = [];
    
    // Initialize renderer
    this._initialize();
    
    // Setup resize observer
    this._setupResizeObserver();
  }
  
  /**
   * Initialize the appropriate renderer
   * @private
   */
  _initialize() {
    if (!this.useRecharts) {
      // Create canvas element for fallback
      this.canvas = document.createElement('canvas');
      this._resizeCanvasForDPR();
      this.container.appendChild(this.canvas);
      this.ctx = this.canvas.getContext('2d');
    }
  }
  
  /**
   * Set up resize observer for responsive updating
   * @private
   */
  _setupResizeObserver() {
    // Use ResizeObserver if available for better performance
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(entries => {
        for (const entry of entries) {
          if (entry.target === this.container) {
            this._handleResize();
          }
        }
      });
      this.resizeObserver.observe(this.container);
    } else {
      // Fallback to window resize event
      window.addEventListener('resize', this._handleResize.bind(this));
    }
  }
  
  /**
   * Size the canvas properly for device pixel ratio
   * @private
   */
  _resizeCanvasForDPR() {
    if (!this.canvas) return;
    
    // Get the device pixel ratio
    const dpr = window.devicePixelRatio || 1;
    
    // Get display size
    const displayWidth = this.container.clientWidth;
    const displayHeight = this.container.clientHeight;
    
    // Set canvas size with device pixel ratio considered
    this.canvas.width = displayWidth * dpr;
    this.canvas.height = displayHeight * dpr;
    
    // Set display size
    this.canvas.style.width = `${displayWidth}px`;
    this.canvas.style.height = `${displayHeight}px`;
    
    // Scale all drawing operations by the dpr
    if (this.ctx) {
      this.ctx.scale(dpr, dpr);
    }
  }
  
  /**
   * Handle container resize
   * @private
   */
  _handleResize() {
    if (this.canvas) {
      this._resizeCanvasForDPR();
      this.render(this.forceData, this.rfdData);
    } else if (this.useRecharts && (this.forceData.length > 0 || this.rfdData.length > 0)) {
      // For Recharts, re-render with current data
      this.render(this.forceData, this.rfdData);
    }
  }
  
  /**
   * Set chart options
   * @param {Object} options - Chart options
   */
  setOptions(options) {
    this.options = { ...this.options, ...options };
    
    // Re-render if we have data
    if (this.forceData.length > 0 || this.rfdData.length > 0) {
      this.render(this.forceData, this.rfdData);
    }
  }
  
  /**
   * Detect screen size category
   * @returns {string} - Screen size category (small, medium, large)
   * @private
   */
  _getScreenSizeCategory() {
    const width = window.innerWidth;
    if (width < 480) return 'smaller';
    if (width < 768) return 'small';
    if (width < 1024) return 'medium';
    return 'large';
  }
  
  /**
   * Get responsive config based on screen size
   * @private
   * @returns {Object} - Config object with responsive parameters
   */
  _getResponsiveConfig() {
    const screenSize = this._getScreenSizeCategory();
    
    // Define responsive configurations
    const configs = {
      smaller: {
        dotSize: 0,
        activeDotSize: 5,
        strokeWidth: 2,
        fontSize: 10,
        marginTop: 5,
        marginRight: 10, 
        marginBottom: 5,
        marginLeft: 10,
        xTickCount: 3,
        yTickCount: 3,
        showLabel: false,
        legendPosition: 'top'
      },
      small: {
        dotSize: 2,
        activeDotSize: 6,
        strokeWidth: 2,
        fontSize: 12,
        marginTop: 5,
        marginRight: 20,
        marginBottom: 5,
        marginLeft: 15,
        xTickCount: 4,
        yTickCount: 4,
        showLabel: false,
        legendPosition: 'top'
      },
      medium: {
        dotSize: 3,
        activeDotSize: 7,
        strokeWidth: 2,
        fontSize: 12,
        marginTop: 5,
        marginRight: 30,
        marginBottom: 5,
        marginLeft: 20,
        xTickCount: 5,
        yTickCount: 5,
        showLabel: true,
        legendPosition: 'top'
      },
      large: {
        dotSize: 4,
        activeDotSize: 8,
        strokeWidth: 2.5,
        fontSize: 14,
        marginTop: 10,
        marginRight: 40,
        marginBottom: 10, 
        marginLeft: 30,
        xTickCount: 6,
        yTickCount: 6,
        showLabel: true,
        legendPosition: 'right'
      }
    };
    
    return configs[screenSize];
  }
  
  /**
   * Render force and RFD data on the chart
   * @param {Array} forceData - Array of {time, force} data points
   * @param {Array} rfdData - Array of {time, rfd} data points
   */
  render(forceData, rfdData) {
    // Store data for resize events
    this.forceData = forceData || [];
    this.rfdData = rfdData || [];
    
    if (this.useRecharts) {
      this._renderWithRecharts(forceData, rfdData);
    } else {
      this._renderWithCanvas(forceData, rfdData);
    }
  }
  
  /**
   * Calculate the axis limits based on data and settings
   * @param {Array} forceData - The force data points
   * @param {Array} rfdData - The RFD data points
   * @returns {Object} - Axis limits {maxTime, maxForce, maxRFD}
   * @private
   */
  _calculateAxisLimits(forceData, rfdData) {
    let maxTime = this.options.maxTime;
    let maxForce = this.options.maxForce;
    let maxRFD = this.options.maxRFD;
    
    // If adaptive scaling is enabled, calculate from data
    if (this.options.adaptiveScaling) {
      // Calculate max time across both datasets
      const forceMaxTime = forceData.length > 0 ? Math.max(...forceData.map(d => d.time)) : 0;
      const rfdMaxTime = rfdData.length > 0 ? Math.max(...rfdData.map(d => d.time)) : 0;
      const dataMaxTime = Math.max(forceMaxTime, rfdMaxTime);
      maxTime = Math.max(dataMaxTime + 1, this.options.maxTime); // Add padding
      
      // Calculate max force if we have force data
      if (forceData.length > 0) {
        const dataMaxForce = Math.max(...forceData.map(d => d.force), 1);
        maxForce = Math.max(dataMaxForce * 1.1, this.options.maxForce); // Add 10% padding
      }
      
      // Calculate max RFD if we have RFD data
      if (rfdData.length > 0) {
        const dataMaxRFD = Math.max(...rfdData.map(d => d.rfd), 1);
        maxRFD = Math.max(dataMaxRFD * 1.1, this.options.maxRFD); // Add 10% padding
      }
    }
    
    return { maxTime, maxForce, maxRFD };
  }
  
  /**
   * Render chart using Recharts library with dual axis
   * @param {Array} forceData - Array of {time, force} data points
   * @param {Array} rfdData - Array of {time, rfd} data points
   * @private
   */
  _renderWithRecharts(forceData, rfdData) {
    const { 
      ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, 
      Legend, ReferenceLine, ResponsiveContainer
    } = Recharts;
    
    // Get responsive configuration
    const responsiveConfig = this._getResponsiveConfig();
    
    // Prepare combined data for the chart
    // We need to merge the two datasets by time to create a unified dataset
    const mergedData = this._mergeDatasets(forceData, rfdData);
    
    // Calculate axis limits
    const { maxTime, maxForce, maxRFD } = this._calculateAxisLimits(forceData, rfdData);
    
    // Custom tooltip to show both force and RFD values
    const CustomTooltip = props => {
      const { active, payload, label } = props;
      if (active && payload && payload.length) {
        return React.createElement(
          'div',
          { 
            style: {
              backgroundColor: this.theme.tooltip,
              padding: '10px',
              borderRadius: '6px',
              boxShadow: '0 2px 5px rgba(0,0,0,0.15)',
              border: `1px solid ${this.theme.grid}`
            }
          },
          React.createElement(
            'p', 
            { 
              style: { 
                margin: '0 0 5px',
                fontSize: `${responsiveConfig.fontSize}px`,
                fontWeight: 'bold',
                color: this.theme.text
              } 
            },
            `Time: ${payload[0].payload.time.toFixed(2)}s`
          ),
          this.options.showForce && payload[0].payload.force !== undefined ? React.createElement(
            'p', 
            { 
              style: { 
                margin: '0 0 3px',
                fontSize: `${responsiveConfig.fontSize}px`,
                color: this.theme.force
              } 
            },
            `Force: ${payload[0].payload.force.toFixed(1)} ${this.options.unit}`
          ) : null,
          this.options.showRFD && payload[0].payload.rfd !== undefined ? React.createElement(
            'p', 
            { 
              style: { 
                margin: 0,
                fontSize: `${responsiveConfig.fontSize}px`,
                color: this.theme.rfd
              } 
            },
            `RFD: ${payload[0].payload.rfd.toFixed(1)} ${this.options.unit}/s`
          ) : null
        );
      }
      
      return null;
    };
    
    // Create Recharts component with dual axis
    const chartComponents = [
      // Grid
      React.createElement(
        CartesianGrid, 
        { 
          strokeDasharray: "3 3",
          stroke: this.theme.grid,
          strokeOpacity: 0.7
        }
      ),
      
      // X-Axis
      React.createElement(
        XAxis, 
        { 
          dataKey: "time",
          type: "number",
          domain: [0, maxTime],
          tickCount: responsiveConfig.xTickCount,
          tick: { fontSize: responsiveConfig.fontSize, fill: this.theme.text },
          axisLine: { stroke: this.theme.text },
          tickLine: { stroke: this.theme.text },
          label: responsiveConfig.showLabel ? { 
            value: 'Time (seconds)', 
            position: 'insideBottomRight', 
            offset: -5,
            fontSize: responsiveConfig.fontSize,
            fill: this.theme.text
          } : null
        }
      ),
      
      // Custom Tooltip
      React.createElement(
        Tooltip, 
        { content: CustomTooltip }
      ),
      
      // Legend
      React.createElement(
        Legend,
        {
          verticalAlign: responsiveConfig.legendPosition === 'top' ? 'top' : 'middle',
          align: responsiveConfig.legendPosition === 'top' ? 'right' : 'right',
          layout: responsiveConfig.legendPosition === 'top' ? 'horizontal' : 'vertical',
          iconType: 'circle',
          wrapperStyle: responsiveConfig.legendPosition === 'top' ? 
            { fontSize: responsiveConfig.fontSize } : 
            { fontSize: responsiveConfig.fontSize, right: 0, top: '40%' }
        }
      )
    ];
    
    // Helper function to generate components for an axis, reducing code duplication
    const createAxisComponents = ({
      axisId, dataKey, name, unit, color, targetColor,
      orientation, max, targetValue, showTargetLine
    }) => {
      const components = [];

      // Y-Axis
      components.push(React.createElement(YAxis, {
        yAxisId: axisId,
        orientation: orientation,
        domain: [0, max],
        tickCount: responsiveConfig.yTickCount,
        tick: { fontSize: responsiveConfig.fontSize, fill: color },
        axisLine: { stroke: color },
        tickLine: { stroke: color },
        label: responsiveConfig.showLabel ? {
          value: `${name} (${unit})`,
          angle: orientation === 'right' ? 90 : -90,
          position: orientation === 'right' ? 'insideRight' : 'insideLeft',
          fontSize: responsiveConfig.fontSize,
          fill: color
        } : null
      }));

      // Data Line
      components.push(React.createElement(Line, {
        yAxisId: axisId,
        type: this.options.smoothCurve ? "monotone" : "linear",
        dataKey: dataKey,
        stroke: color,
        strokeWidth: responsiveConfig.strokeWidth,
        activeDot: { r: responsiveConfig.activeDotSize },
        dot: { r: responsiveConfig.dotSize, fill: color },
        name: name
      }));

      // Target Line
      if (showTargetLine) {
        components.push(React.createElement(ReferenceLine, {
          yAxisId: axisId,
          y: targetValue,
          stroke: targetColor,
          strokeWidth: 1.5,
          strokeDasharray: "5 5",
          label: responsiveConfig.showLabel ? {
            value: `Target ${name}`,
            position: orientation === 'right' ? 'left' : 'right',
            fill: targetColor,
            fontSize: responsiveConfig.fontSize - 1
          } : null
        }));
      }

      return components;
    };

    // Add Force components if enabled
    if (this.options.showForce) {
      chartComponents.push(...createAxisComponents({
        axisId: 'force', dataKey: 'force', name: 'Force', unit: this.options.unit,
        color: this.theme.force, targetColor: this.theme.forceTarget,
        orientation: 'left', max: maxForce, targetValue: this.options.targetForce,
        showTargetLine: this.options.showForceTargetLine
      }));
    }
    
    // Add RFD components if enabled
    if (this.options.showRFD) {
      chartComponents.push(...createAxisComponents({
        axisId: 'rfd', dataKey: 'rfd', name: 'RFD', unit: `${this.options.unit}/s`,
        color: this.theme.rfd, targetColor: this.theme.rfdTarget,
        orientation: 'right', max: maxRFD, targetValue: this.options.targetRFD,
        showTargetLine: this.options.showRFDTargetLine
      }));
    }
    
    // Create responsive container with chart
    const chart = React.createElement(
      ResponsiveContainer,
      { width: "100%", height: "100%" },
      React.createElement(
        ComposedChart,
        {
          data: mergedData,
          margin: {
            top: responsiveConfig.marginTop,
            right: responsiveConfig.marginRight + (this.options.showRFD ? 30 : 0),
            bottom: responsiveConfig.marginBottom,
            left: responsiveConfig.marginLeft + (this.options.showForce ? 20 : 0)
          }
        },
        ...chartComponents
      )
    );
    
    // Render chart
    ReactDOM.render(chart, this.container);
  }
  
  /**
   * Merge force and RFD datasets by time for unified plotting
   * @param {Array} forceData - Array of {time, force} data points
   * @param {Array} rfdData - Array of {time, rfd} data points
   * @returns {Array} - Merged data array with uniform time points
   * @private
   */
  _mergeDatasets(forceData, rfdData) {
    const mergedMap = new Map();

    // Helper to process a dataset into the map
    const processDataset = (dataset, key) => {
      if (!dataset) return;
      for (const point of dataset) {
        const time = point.time;
        const existing = mergedMap.get(time) || { time };
        existing[key] = point[key];
        mergedMap.set(time, existing);
      }
    };

    processDataset(forceData, 'force');
    processDataset(rfdData, 'rfd');

    // Convert map to array and sort by time
    return Array.from(mergedMap.values()).sort((a, b) => a.time - b.time);
  }
  
  /**
   * Clear the chart by rendering it in an empty state
   */
  clear() {
    // By calling render with empty data, we ensure the chart consistently
    // displays its "empty" state (e.g., "No data to display" message or
    // blank axes) instead of just being wiped. This also correctly resets
    // the internal data state.
    this.render([], []);
  }
  
  /**
   * Render chart using Canvas fallback with dual axis
   * @param {Array} forceData - Array of {time, force} data points
   * @param {Array} rfdData - Array of {time, rfd} data points
   * @private
   */
  _renderWithCanvas(forceData, rfdData) {
    const ctx = this.ctx;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    
    // Get responsive config
    const responsiveConfig = this._getResponsiveConfig();
    
    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    
    // If no data, show empty state
    if ((forceData && forceData.length === 0) && (rfdData && rfdData.length === 0)) {
      ctx.fillStyle = this.theme.text;
      ctx.font = `${responsiveConfig.fontSize}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('No data to display. Start recording to see your force and RFD graph.', width / 2, height / 2);
      return;
    }
    
    // Chart padding based on responsive config
    const padding = { 
      top: responsiveConfig.marginTop + 20, // Extra space for title
      right: responsiveConfig.marginRight + (this.options.showRFD ? 40 : 0), // Extra space for right axis
      bottom: responsiveConfig.marginBottom + 20, // Extra space for x axis labels
      left: responsiveConfig.marginLeft + (this.options.showForce ? 40 : 0)  // Extra space for left axis labels
    };
    
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;
    
    // Calculate axis limits
    const { maxTime, maxForce, maxRFD } = this._calculateAxisLimits(forceData, rfdData);
    
    // Draw background grid
    this._drawGrid(ctx, padding, chartWidth, chartHeight, 
                  responsiveConfig.xTickCount, responsiveConfig.yTickCount);
    
    // Draw axes and labels
    this._drawDualAxes(ctx, padding, width, height, chartWidth, chartHeight, 
                      maxTime, maxForce, maxRFD, responsiveConfig);
    
    // Draw legend
    this._drawLegend(ctx, padding, width, responsiveConfig);
    
    // Draw target lines if enabled
    if (this.options.showForceTargetLine && this.options.showForce) {
      this._drawTargetLine(ctx, padding, chartWidth, chartHeight, 
                          this.options.targetForce, maxForce, "force", this.theme.forceTarget);
    }
    
    if (this.options.showRFDTargetLine && this.options.showRFD) {
      this._drawTargetLine(ctx, padding, chartWidth, chartHeight, 
                          this.options.targetRFD, maxRFD, "rfd", this.theme.rfdTarget);
    }
    
    // Draw data lines
    if (forceData && forceData.length > 0 && this.options.showForce) {
      this._drawDataLine(ctx, forceData, padding, chartWidth, chartHeight, 
                         maxTime, maxForce, "force", this.theme.force, responsiveConfig);
    }
    
    if (rfdData && rfdData.length > 0 && this.options.showRFD) {
      this._drawDataLine(ctx, rfdData, padding, chartWidth, chartHeight, 
                         maxTime, maxRFD, "rfd", this.theme.rfd, responsiveConfig);
    }
  }
  
  /**
   * Draw grid lines on canvas
   * @private
   */
  _drawGrid(ctx, padding, chartWidth, chartHeight, xTickCount, yTickCount) {
    ctx.strokeStyle = this.theme.grid;
    ctx.lineWidth = 0.5;
    ctx.setLineDash([3, 3]);
    
    // Vertical grid lines
    for (let i = 0; i <= xTickCount; i++) {
      const x = padding.left + (i / xTickCount) * chartWidth;
      ctx.beginPath();
      ctx.moveTo(x, padding.top);
      ctx.lineTo(x, padding.top + chartHeight);
      ctx.stroke();
    }
    
    // Horizontal grid lines
    for (let i = 0; i <= yTickCount; i++) {
      const y = padding.top + chartHeight - (i / yTickCount) * chartHeight;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(padding.left + chartWidth, y);
      ctx.stroke();
    }
    
    ctx.setLineDash([]);
  }
  
  /**
   * Draw dual axes on canvas
   * @private
   */
  _drawDualAxes(ctx, padding, width, height, chartWidth, chartHeight, 
                maxTime, maxForce, maxRFD, config) {
    ctx.lineWidth = 1;
    ctx.setLineDash([]);
    
    // X-axis
    ctx.strokeStyle = this.theme.text;
    ctx.beginPath();
    ctx.moveTo(padding.left, height - padding.bottom);
    ctx.lineTo(width - padding.right, height - padding.bottom);
    ctx.stroke();
    
    // Left Y-axis (Force)
    if (this.options.showForce) {
      ctx.strokeStyle = this.theme.force;
      ctx.beginPath();
      ctx.moveTo(padding.left, padding.top);
      ctx.lineTo(padding.left, height - padding.bottom);
      ctx.stroke();
    }
    
    // Right Y-axis (RFD)
    if (this.options.showRFD) {
      ctx.strokeStyle = this.theme.rfd;
      ctx.beginPath();
      ctx.moveTo(width - padding.right, padding.top);
      ctx.lineTo(width - padding.right, height - padding.bottom);
      ctx.stroke();
    }
    
    // X-axis labels
    ctx.fillStyle = this.theme.text;
    ctx.font = `${config.fontSize}px sans-serif`;
    ctx.textAlign = 'center';
    const xLabelCount = config.xTickCount;
    for (let i = 0; i <= xLabelCount; i++) {
      const value = (i / xLabelCount) * maxTime;
      const x = padding.left + (i / xLabelCount) * chartWidth;
      ctx.fillText(value.toFixed(1) + 's', x, height - padding.bottom + 15);
    }
    
    // X-axis title if enough space
    if (config.showLabel) {
      ctx.fillStyle = this.theme.text;
      ctx.font = `${config.fontSize}px sans-serif`;
      ctx.fillText('Time (seconds)', padding.left + chartWidth / 2, height - 5);
    }
    
    // Left Y-axis labels (Force)
    if (this.options.showForce) {
      ctx.fillStyle = this.theme.force;
      ctx.textAlign = 'right';
      const yLabelCount = config.yTickCount;
      
      for (let i = 0; i <= yLabelCount; i++) {
        const value = (i / yLabelCount) * maxForce;
        const y = height - padding.bottom - (i / yLabelCount) * chartHeight;
        ctx.fillText(value.toFixed(0), padding.left - 5, y + 3);
      }
      
      // Y-axis title if enough space
      if (config.showLabel) {
        ctx.save();
        ctx.translate(15, padding.top + chartHeight / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.textAlign = 'center';
        ctx.fillText(`Force (${this.options.unit})`, 0, 0);
        ctx.restore();
      }
    }
    
    // Right Y-axis labels (RFD)
    if (this.options.showRFD) {
      ctx.fillStyle = this.theme.rfd;
      ctx.textAlign = 'left';
      const yLabelCount = config.yTickCount;
      
      for (let i = 0; i <= yLabelCount; i++) {
        const value = (i / yLabelCount) * maxRFD;
        const y = height - padding.bottom - (i / yLabelCount) * chartHeight;
        ctx.fillText(value.toFixed(0), width - padding.right + 5, y + 3);
      }
      
      // Y-axis title if enough space
      if (config.showLabel) {
        ctx.save();
        ctx.translate(width - 15, padding.top + chartHeight / 2);
        ctx.rotate(Math.PI / 2);
        ctx.textAlign = 'center';
        ctx.fillText(`RFD (${this.options.unit}/s)`, 0, 0);
        ctx.restore();
      }
    }
  }
  
  /**
   * Draw legend on canvas
   * @private
   */
  _drawLegend(ctx, padding, width, config) {
    const legendX = width - padding.right - 100;
    const legendY = padding.top - 10;
    const itemHeight = 20;
    
    let offsetY = 0;
    
    if (this.options.showForce) {
      // Force legend
      ctx.fillStyle = this.theme.force;
      ctx.beginPath();
      ctx.arc(legendX, legendY + offsetY, 5, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.fillStyle = this.theme.text;
      ctx.font = `${config.fontSize}px sans-serif`;
      ctx.textAlign = 'left';
      ctx.fillText('Force', legendX + 10, legendY + offsetY + 4);
      
      offsetY += itemHeight;
    }
    
    if (this.options.showRFD) {
      // RFD legend
      ctx.fillStyle = this.theme.rfd;
      ctx.beginPath();
      ctx.arc(legendX, legendY + offsetY, 5, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.fillStyle = this.theme.text;
      ctx.font = `${config.fontSize}px sans-serif`;
      ctx.textAlign = 'left';
      ctx.fillText('RFD', legendX + 10, legendY + offsetY + 4);
    }
  }
  
  /**
   * Draw target line on canvas
   * @private
   */
  _drawTargetLine(ctx, padding, chartWidth, chartHeight, targetValue, maxValue, type, color) {
    // Calculate Y position
    const y = padding.top + chartHeight - (targetValue / maxValue) * chartHeight;
    
    ctx.beginPath();
    ctx.setLineDash([5, 5]);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.moveTo(padding.left, y);
    ctx.lineTo(padding.left + chartWidth, y);
    ctx.stroke();
    ctx.setLineDash([]);
    
    // Label for target line
    ctx.fillStyle = color;
    ctx.textAlign = type === 'force' ? 'left' : 'right';
    const labelX = type === 'force' ? padding.left + 10 : padding.left + chartWidth - 10;
    ctx.fillText(`Target ${type === 'force' ? 'Force' : 'RFD'}`, labelX, y - 5);
  }
  
  /**
   * Draw data line on canvas
   * @private
   */
  _drawDataLine(ctx, data, padding, chartWidth, chartHeight, maxTime, maxValue, type, color, config) {
    // Skip if no data
    if (data.length === 0) return;
    
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = config.strokeWidth;
    ctx.lineJoin = 'round';
    
    const getValue = point => type === 'force' ? point.force : point.rfd;
    
    // Move to first point
    const firstX = padding.left + (data[0].time / maxTime) * chartWidth;
    const firstY = padding.top + chartHeight - (getValue(data[0]) / maxValue) * chartHeight;
    ctx.moveTo(firstX, firstY);
    
    // Draw path through all points
    for (let i = 1; i < data.length; i++) {
      const x = padding.left + (data[i].time / maxTime) * chartWidth;
      const y = padding.top + chartHeight - (getValue(data[i]) / maxValue) * chartHeight;
      
      if (this.options.smoothCurve && i < data.length - 1) {
        // Use bezier curves for smoother lines
        const x0 = padding.left + (data[i-1].time / maxTime) * chartWidth;
        const y0 = padding.top + chartHeight - (getValue(data[i-1]) / maxValue) * chartHeight;
        const x1 = x;
        const y1 = y;
        
        const cpX1 = x0 + (x1 - x0) / 2;
        const cpX2 = x1 - (x1 - x0) / 2;
        
        ctx.bezierCurveTo(cpX1, y0, cpX2, y1, x1, y1);
      } else {
        ctx.lineTo(x, y);
      }
    }
    
    ctx.stroke();
    
    // Draw data points
    if (config.dotSize > 0) {
      for (const point of data) {
        const x = padding.left + (point.time / maxTime) * chartWidth;
        const y = padding.top + chartHeight - (getValue(point) / maxValue) * chartHeight;
        
        ctx.beginPath();
        ctx.fillStyle = color;
        ctx.arc(x, y, config.dotSize, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}
