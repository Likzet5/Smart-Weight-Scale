"""
MicroPython driver for the Adafruit NAU7802 I2C 24-bit ADC.
Designed for Raspberry Pi Pico with machine.I2C.
"""
import time
from machine import I2C, Pin

# Constants
NAU7802_I2CADDR_DEFAULT = 0x2A  # I2C address
NAU7802_PU_CTRL = 0x00          # Power control register
NAU7802_CTRL1 = 0x01            # Control/config register #1
NAU7802_CTRL2 = 0x02            # Control/config register #2
NAU7802_ADCO_B2 = 0x12          # ADC output LSB
NAU7802_ADC = 0x15              # ADC / chopper control
NAU7802_PGA = 0x1B              # PGA control
NAU7802_POWER = 0x1C            # power control
NAU7802_REVISION_ID = 0x1F      # Chip revision ID

# LDO voltage options
NAU7802_LDO_4V5 = 0
NAU7802_LDO_4V2 = 1
NAU7802_LDO_3V9 = 2
NAU7802_LDO_3V6 = 3
NAU7802_LDO_3V3 = 4
NAU7802_LDO_3V0 = 5
NAU7802_LDO_2V7 = 6
NAU7802_LDO_2V4 = 7
NAU7802_LDO_EXTERNAL = 8

# Gain options
NAU7802_GAIN_1 = 0
NAU7802_GAIN_2 = 1
NAU7802_GAIN_4 = 2
NAU7802_GAIN_8 = 3
NAU7802_GAIN_16 = 4
NAU7802_GAIN_32 = 5
NAU7802_GAIN_64 = 6
NAU7802_GAIN_128 = 7

# Sample rate options
NAU7802_RATE_10SPS = 0
NAU7802_RATE_20SPS = 1
NAU7802_RATE_40SPS = 2
NAU7802_RATE_80SPS = 3
NAU7802_RATE_320SPS = 7

# Calibration modes
NAU7802_CALMOD_INTERNAL = 0
NAU7802_CALMOD_OFFSET = 2
NAU7802_CALMOD_GAIN = 3

class NAU7802:
    """Driver for the NAU7802 I2C ADC."""
    
    def __init__(self, i2c, addr=NAU7802_I2CADDR_DEFAULT):
        """Initialize the NAU7802 driver with an I2C interface.
        
        Args:
            i2c: The I2C instance
            addr: The I2C address of the device
        """
        self.i2c = i2c
        self.addr = addr
        
    def _read_register(self, reg):
        """Read a byte from the specified register."""
        return self.i2c.readfrom_mem(self.addr, reg, 1)[0]
    
    def _write_register(self, reg, value):
        """Write a byte to the specified register."""
        self.i2c.writeto_mem(self.addr, reg, bytes([value]))
        
    def _read_bit(self, reg, bit_position):
        """Read a single bit from a register."""
        reg_value = self._read_register(reg)
        return (reg_value >> bit_position) & 0x01
    
    def _write_bit(self, reg, bit_position, value):
        """Write a single bit to a register."""
        reg_value = self._read_register(reg)
        if value:
            reg_value |= (1 << bit_position)
        else:
            reg_value &= ~(1 << bit_position)
        self._write_register(reg, reg_value)
        return True
    
    def _read_bits(self, reg, bit_position, num_bits):
        """Read multiple bits from a register."""
        reg_value = self._read_register(reg)
        mask = ((1 << num_bits) - 1) << bit_position
        return (reg_value & mask) >> bit_position
    
    def _write_bits(self, reg, bit_position, num_bits, value):
        """Write multiple bits to a register."""
        reg_value = self._read_register(reg)
        mask = ((1 << num_bits) - 1) << bit_position
        reg_value &= ~mask
        reg_value |= (value << bit_position) & mask
        self._write_register(reg, reg_value)
        return True
    
    def begin(self):
        """Initialize the NAU7802 and verify communication.
        
        Returns:
            bool: True if initialization was successful, False otherwise
        """
        # Perform reset
        if not self.reset():
            return False
            
        if not self.enable(True):
            return False
            
        # Check revision ID to verify communication
        rev_id = self._read_register(NAU7802_REVISION_ID)
        if (rev_id & 0x0F) != 0x0F:
            return False
            
        # Initial configuration
        if not self.setLDO(NAU7802_LDO_3V3):
            return False
            
        if not self.setGain(NAU7802_GAIN_128):
            return False
            
        if not self.setRate(NAU7802_RATE_10SPS):
            return False
            
        # Disable ADC chopper clock
        if not self._write_bits(NAU7802_ADC, 4, 2, 0x3):
            return False
            
        # Use low ESR caps
        if not self._write_bit(NAU7802_PGA, 6, 0):
            return False
            
        # PGA stabilizer cap on output
        if not self._write_bit(NAU7802_POWER, 7, 1):
            return False
        
        #time.sleep_ms(10)

        return True
    
    def reset(self):
        """Perform a soft reset of the device.
        
        Returns:
            bool: True if successful
        """
        # Set RR bit to 1
        self._write_bit(NAU7802_PU_CTRL, 0, 1)
        time.sleep_ms(10)
        
        # Set RR bit to 0 and PUD bit to 1
        self._write_bit(NAU7802_PU_CTRL, 0, 0)
        self._write_bit(NAU7802_PU_CTRL, 1, 1)
        
        # Wait for power-up to complete
        time.sleep_ms(1)
        return self._read_bit(NAU7802_PU_CTRL, 3)
    
    def enable(self, enable_flag):
        """Enable or disable the NAU7802.
        
        Args:
            enable_flag: True to enable, False to disable
            
        Returns:
            bool: True if successful
        """
        if not enable_flag:
            # Power down
            self._write_bit(NAU7802_PU_CTRL, 2, 0)  # Analog off
            self._write_bit(NAU7802_PU_CTRL, 1, 0)  # Digital off
            return True
            
        # Power up digital
        self._write_bit(NAU7802_PU_CTRL, 1, 1)
        # Power up analog
        self._write_bit(NAU7802_PU_CTRL, 2, 1)
        
        # Wait for analog power to stabilize (600ms)
        time.sleep_ms(600)
        
        # Set start bit
        self._write_bit(NAU7802_PU_CTRL, 4, 1)
        
        # Check ready bit
        return self._read_bit(NAU7802_PU_CTRL, 3)
    
    def available(self):
        """Check if new ADC data is available.
        
        Returns:
            bool: True if new data is available
        """
        return self._read_bit(NAU7802_PU_CTRL, 5)
    
    def read(self):
        """Read the 24-bit ADC value.
        
        Returns:
            int: Signed 24-bit ADC value (sign-extended to 32 bits)
        """
        # Read 3 bytes (24 bits) starting from ADCO_B2
        data = self.i2c.readfrom_mem(self.addr, NAU7802_ADCO_B2, 3)
        
        # Convert to int32 (signed)
        value = (data[0] << 16) | (data[1] << 8) | data[2]

        # For debugging extreme values
        if value > 10000000:  # If value seems suspiciously large
            print(f"Raw bytes: {data[0]:02x} {data[1]:02x} {data[2]:02x} -> {value}")
        
        # Sign extend if negative (if bit 23 is set)
        if value & 0x800000:
            value = value - 0x1000000  # Two's complement for 24-bit value
            
        return value
    
    def setLDO(self, voltage):
        """Set the LDO voltage.
        
        Args:
            voltage: The desired LDO voltage constant
            
        Returns:
            bool: True if successful
        """
        if voltage == NAU7802_LDO_EXTERNAL:
            # Special case for external LDO
            return self._write_bit(NAU7802_PU_CTRL, 7, 0)
            
        # Enable internal LDO
        if not self._write_bit(NAU7802_PU_CTRL, 7, 1):
            return False
            
        # Set LDO voltage
        return self._write_bits(NAU7802_CTRL1, 3, 3, voltage)
    
    def getLDO(self):
        """Get the current LDO voltage setting.
        
        Returns:
            int: The LDO voltage constant
        """
        # Check if using external LDO
        if not self._read_bit(NAU7802_PU_CTRL, 7):
            return NAU7802_LDO_EXTERNAL
            
        # Return LDO voltage setting
        return self._read_bits(NAU7802_CTRL1, 3, 3)
    
    def setGain(self, gain):
        """Set the ADC gain.
        
        Args:
            gain: The desired gain constant
            
        Returns:
            bool: True if successful
        """
        return self._write_bits(NAU7802_CTRL1, 0, 3, gain)
    
    def getGain(self):
        """Get the current ADC gain setting.
        
        Returns:
            int: The gain constant
        """
        return self._read_bits(NAU7802_CTRL1, 0, 3)
    
    def setRate(self, rate):
        """Set the ADC sample rate.
        
        Args:
            rate: The desired sample rate constant
            
        Returns:
            bool: True if successful
        """
        return self._write_bits(NAU7802_CTRL2, 4, 3, rate)
    
    def getRate(self):
        """Get the current ADC sample rate setting.
        
        Returns:
            int: The sample rate constant
        """
        return self._read_bits(NAU7802_CTRL2, 4, 3)
    
    def calibrate(self, mode):
        """Perform the internal calibration procedure.
        
        Args:
            mode: The calibration mode constant
            
        Returns:
            bool: True if calibration was successful
        """
        # Set calibration mode
        if not self._write_bits(NAU7802_CTRL2, 0, 2, mode):
            return False
            
        # Start calibration
        if not self._write_bit(NAU7802_CTRL2, 2, 1):
            return False
            
        # Wait for calibration to complete
        while not self._read_bit(NAU7802_CTRL2, 2):
            time.sleep_ms(10)
            
        # Check for calibration error
        return not self._read_bit(NAU7802_CTRL2, 3)
