# Smart Weight Scale
This project transforms a standard load cell into a smart, Bluetooth-enabled weight and strength measurement tool. It uses a Raspberry Pi Pico 2W to read data from a NAU7802 ADC, transmitting the information wirelessly to a web-based interface for real-time analysis and visualization. The platform is designed to be compatible with the Tindeq API protocol.

## Key Features
- **Real-time Data Acquisition:** Captures high-frequency weight and force data from a load cell.
- **Bluetooth LE Connectivity:** Wirelessly sends data to any compatible web browser using the Web Bluetooth API.
- **Advanced Web Interface:** A comprehensive dashboard for visualizing data, including:
  - Live Force and RFD (Rate of Force Development) gauges.
  - A dual-axis chart showing force and RFD over time.
  - In-depth statistics (peak force, average force, time to peak, and impulse).
- **User-friendly Controls:**
  - Easily tare (zero) the scale and calibrate it with a known weight.
  - Record and reset measurement sessions.
  - Includes a demo mode for testing the interface without hardware.
## Technology Stack
**Hardware**
- **Raspberry Pi Pico 2W:** The core microcontroller for processing and transmitting data.
- **NAU7802 ADC:** A 24-bit analog-to-digital converter for precise measurements.
- **Load Cell:** The sensor that measures force and weight.
## Software
- **Pico (MicroPython):** The firmware includes custom drivers for the NAU7802 and manages BLE advertising and services.
- **Web Interface (HTML, CSS, JavaScript):** A responsive front-end application that communicates directly with the device via the Web Bluetooth API. It uses Recharts for interactive data visualization and Tailwind CSS for styling.
- **Web Bluetooth API:** Enables direct communication between the browser and the Pico.
- **BLE Services:** Implements a custom GATT service for sending batched weight data and receiving control commands.
