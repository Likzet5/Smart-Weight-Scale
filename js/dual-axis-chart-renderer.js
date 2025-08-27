/**
 * Enhanced dual-axis chart rendering for the Strength Training Monitor
 * Supports visualization of both Force and RFD (Rate of Force Development)
 * USES CHART.JS
 */
export class DualAxisChartRenderer {
  /**
   * Create a chart renderer instance
   * @param {string} containerId - DOM ID of chart container
   */
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.canvas = document.createElement('canvas');
    this.container.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');
    this.chart = null; // To hold the Chart.js instance

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
        maxTime: 12, // Default maxTime
        maxForce: 150,
        maxRFD: 1000,
        adaptiveScaling: true,
        smoothCurve: true
    };

    this._initialize();
  }

  /**
   * Initialize the chart
   * @private
   */
  _initialize() {
    this.chart = new Chart(this.ctx, {
      type: 'line',
      data: {
        labels: [],
        datasets: [
          {
            label: 'Force',
            data: [],
            borderColor: this.theme.force,
            backgroundColor: this.theme.force,
            yAxisID: 'yForce',
          },
          {
            label: 'RFD',
            data: [],
            borderColor: this.theme.rfd,
            backgroundColor: this.theme.rfd,
            yAxisID: 'yRFD',
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            type: 'linear',
            position: 'bottom',
            title: {
              display: true,
              text: 'Time (s)'
            },
            max: this.options.maxTime, // Set initial max time
          },
          yForce: {
            type: 'linear',
            position: 'left',
            title: {
              display: true,
              text: `Force (${this.options.unit})`
            },
            grid: {
              drawOnChartArea: false,
            },
          },
          yRFD: {
            type: 'linear',
            position: 'right',
            title: {
              display: true,
              text: `RFD (${this.options.unit}/s)`
            },
            grid: {
                drawOnChartArea: false,
              },
          }
        }
      }
    });
  }

  /**
   * Set chart options
   * @param {Object} options - Chart options
   */
  setOptions(options) {
    this.options = { ...this.options, ...options };
    this.chart.options.scales.x.max = this.options.maxTime; // Update max time
    this.chart.options.scales.yForce.title.text = `Force (${this.options.unit})`;
    this.chart.options.scales.yRFD.title.text = `RFD (${this.options.unit}/s)`;
    this.chart.update();
  }

  /**
   * Render force and RFD data on the chart
   * @param {Array} forceData - Array of {time, force} data points
   * @param {Array} rfdData - Array of {time, rfd} data points
   */
  render(forceData, rfdData) {
    // With Chart.js, we don't need a separate render call like with Recharts.
    // The data will be updated via the UI's batching mechanism.
  }

  /**
   * Clear the chart
   */
  clear() {
    this.chart.data.labels = [];
    this.chart.data.datasets.forEach((dataset) => {
        dataset.data = [];
    });
    this.chart.update();
  }
}