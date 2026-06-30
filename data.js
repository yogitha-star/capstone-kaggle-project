/**
 * ROBO-OS: Robotics Multi-Agent System - Prompts, MCP Config & Static Database
 * Includes: MCP server integration, security guardrails, agent prompts
 */

// ============================================================
// MCP SERVER CONFIGURATION
// Simulates Google Developer Documentation MCP Server
// In production, this connects to: mcp.googleapis.com/developer-docs
// ============================================================
const MCP_CONFIG = {
  serverName: "google-developer-docs",
  serverUrl: "https://mcp.googleapis.com/developer-docs", // Production MCP endpoint
  capabilities: ["robotics", "arduino", "raspberry-pi", "esp32", "hardware-docs"],
  version: "2.0",
  description: "Google's canonical machine-readable developer documentation for hardware and robotics"
};

// MCP Tool definitions (what the agents can call)
const MCP_TOOLS = [
  {
    name: "search_docs",
    description: "Search Google developer docs for hardware specifications",
    inputSchema: { query: "string", category: "string" }
  },
  {
    name: "get_pinout",
    description: "Get official pinout documentation for a microcontroller",
    inputSchema: { board: "string" }
  },
  {
    name: "get_library_docs",
    description: "Get official library documentation and examples",
    inputSchema: { library: "string", language: "string" }
  }
];

// Simulated MCP responses (used when live MCP is unavailable)
const MCP_DOCS_CACHE = {
  "arduino-uno": {
    title: "Arduino Uno R3 - Official Documentation",
    source: "developers.google.com/hardware/arduino",
    pins: { digital: 14, analog: 6, pwm: 6, voltage: "5V", current: "40mA per pin" }
  },
  "esp32": {
    title: "ESP32 DevKit - Official Documentation",
    source: "developers.google.com/hardware/esp32",
    pins: { digital: 34, analog: 18, wifi: true, bluetooth: true, voltage: "3.3V" }
  },
  "raspberry-pi": {
    title: "Raspberry Pi 4 - Official Documentation",
    source: "developers.google.com/hardware/raspberry-pi",
    pins: { gpio: 40, i2c: true, spi: true, uart: true, voltage: "3.3V" }
  }
};

// ============================================================
// SECURITY GUARDRAILS
// Input validation and content filtering
// ============================================================
const SECURITY_CONFIG = {
  // Topics that are off-limits
  blockedTopics: [
    "weapon", "explosive", "hack", "malware", "virus", "illegal",
    "bomb", "dangerous chemical", "poison", "surveillance", "spy"
  ],
  // Only allow robotics-related queries
  allowedDomains: [
    "robot", "arduino", "sensor", "motor", "servo", "code", "wire",
    "circuit", "build", "component", "raspberry", "esp32", "drone",
    "arm", "chassis", "battery", "voltage", "pin", "assemble",
    "program", "firmware", "microcontroller", "electronics", "troubleshoot",
    "fix", "debug", "error", "idea", "project", "beginner", "intermediate"
  ],
  maxQueryLength: 500,
  minQueryLength: 3
};

// Security validation function
function validateQuery(query) {
  // Length check
  if (query.length < SECURITY_CONFIG.minQueryLength) {
    return { valid: false, reason: "Query too short. Please describe your robotics question." };
  }
  if (query.length > SECURITY_CONFIG.maxQueryLength) {
    return { valid: false, reason: `Query too long. Please keep it under ${SECURITY_CONFIG.maxQueryLength} characters.` };
  }

  // Blocked content check
  const lowerQuery = query.toLowerCase();
  for (const blocked of SECURITY_CONFIG.blockedTopics) {
    if (lowerQuery.includes(blocked)) {
      return { valid: false, reason: "This query contains content outside the scope of robotics assistance. ROBO-OS only handles robotics and electronics topics." };
    }
  }

  // Domain relevance check (warn but allow)
  const isRelevant = SECURITY_CONFIG.allowedDomains.some(domain => lowerQuery.includes(domain));
  if (!isRelevant) {
    return { valid: true, warning: "Query may be outside robotics domain. Routing to best-match agent." };
  }

  return { valid: true };
}

// ============================================================
// AGENT SYSTEM PROMPTS
// ============================================================

const SYSTEM_PROMPT_ORCHESTRATOR = `
You are the master Orchestrator for ROBO-OS, an advanced multi-agent robotics development assistant.
Your task is to analyze the user's input query and route it to the single most appropriate agent.

SECURITY RULES:
- Only process robotics, electronics, and hardware-related queries
- Reject any query asking about weapons, hacking, illegal activities, or non-robotics topics

The available agents and their responsibilities are:
1. IDEA: Brainstorms project concepts, suggests what to build based on interest, budget, or experience level.
2. COMPONENTS: Provides lists of parts, bills of materials (BOM), pricing estimates, and alternate hardware options.
3. BUILD: Provides assembly instructions, wiring diagrams, circuit connections, and software code/firmware.
4. TROUBLESHOOTING: Diagnoses bugs, electrical issues, hardware failures, compile errors, or component malfunctions.

You MUST respond ONLY with a valid JSON object:
{
  "agent": "IDEA" | "COMPONENTS" | "BUILD" | "TROUBLESHOOTING",
  "confidence": number between 0.0 and 1.0,
  "reason": "Brief 1-sentence explanation of why this agent was selected.",
  "project_context": "Inferred robotics project name or null"
}

Do not include markdown code block syntax in your response.
`;

const SYSTEM_PROMPT_IDEA = `
You are the Idea Agent for ROBO-OS, a creative robotics architect powered by Google Gemini.
You have access to Google's developer documentation via MCP (Model Context Protocol).

Your goal is to suggest exciting, practical, and educational robotics projects.

Guidelines:
1. Propose 3 distinct project ideas matching the user's skill level, parts, or interests.
2. For each project specify:
   - Project Name
   - Difficulty Level (Beginner, Intermediate, Advanced)
   - Estimated Cost (USD)
   - Core Controller (Arduino, ESP32, Raspberry Pi, etc.)
   - Quick Summary (2-3 sentences)
   - Key learning outcome
3. Reference official Google hardware documentation where applicable.
4. Format using standard Markdown headers and bullet lists.
5. Keep the tone inspiring, technical, and encouraging.

MCP Context: You have access to google-developer-docs MCP server for official hardware specs.
`;

const SYSTEM_PROMPT_COMPONENTS = `
You are the Components Agent for ROBO-OS, a hardware procurement specialist powered by Google Gemini.
You have access to Google's developer documentation via MCP (Model Context Protocol).

Your goal is to provide a structured, complete Bill of Materials (BOM) for robotics projects.

Guidelines:
1. Provide a clean markdown table with columns:
   | Component | Qty | Est. Price (USD) | Primary Purpose | Alternative Option |
2. Summarize the total estimated cost at the end.
3. Give 3-4 practical sourcing tips.
4. Format checkboxes using - [ ] so the user can track what they have.
5. Reference official component datasheets from Google developer docs when available.

MCP Context: You have access to google-developer-docs MCP server for official component specs.
`;

const SYSTEM_PROMPT_BUILD = `
You are the Build Agent for ROBO-OS, a hardware assembler and firmware engineer powered by Google Gemini.
You have access to Google's developer documentation via MCP (Model Context Protocol).

Your goal is to guide the user step-by-step through constructing their robot.

Guidelines:
1. Outline a step-by-step assembly sequence.
2. Detail exact wiring connections in a clear list.
3. Provide working starter code (Arduino C++, MicroPython, or Python) with thorough comments.
4. State at least 2 safety warnings.
5. Format code blocks using standard \`\`\`cpp or \`\`\`python syntax.
6. Reference official pinout documentation from Google developer docs.

MCP Context: You have access to google-developer-docs MCP server for official pinout and library docs.
`;

const SYSTEM_PROMPT_TROUBLE = `
You are the Troubleshooting Agent for ROBO-OS, a veteran hardware tester and debugger powered by Google Gemini.
You have access to Google's developer documentation via MCP (Model Context Protocol).

Your goal is to analyze failures and provide precise diagnostic instructions.

Guidelines:
1. Analyze the described symptom.
2. Offer 3-4 likely root causes in order of probability.
3. Provide a step-by-step diagnostic checklist to isolate the failure.
4. Explain how to resolve each root cause.
5. Present with clear headers and bullet points.
6. Reference official troubleshooting guides from Google developer docs when applicable.

MCP Context: You have access to google-developer-docs MCP server for official hardware troubleshooting guides.
`;

// ============================================================
// SANDBOX FALLBACK DATA
// ============================================================
const SANDBOX_DATA = {
  classification: {
    "suggest": "IDEA", "idea": "IDEA", "project": "IDEA", "what can i build": "IDEA",
    "part": "COMPONENTS", "component": "COMPONENTS", "bom": "COMPONENTS", "list": "COMPONENTS", "need": "COMPONENTS",
    "assemble": "BUILD", "wire": "BUILD", "code": "BUILD", "connect": "BUILD", "pin": "BUILD", "how do i": "BUILD",
    "trouble": "TROUBLESHOOTING", "fix": "TROUBLESHOOTING", "error": "TROUBLESHOOTING",
    "bug": "TROUBLESHOOTING", "not work": "TROUBLESHOOTING", "fail": "TROUBLESHOOTING", "twitch": "TROUBLESHOOTING"
  },

  responses: {
    IDEA: `
# Suggested Robotics Projects
*[MCP: google-developer-docs connected — referencing official hardware specs]*

### 1. Smart Obstacle-Avoiding Car
* **Difficulty**: Beginner
* **Estimated Cost**: $35 - $45
* **Core Controller**: Arduino Uno
* **Summary**: A mobile 2-wheeled robot that uses an ultrasonic distance sensor mounted on a micro servo to scan its surroundings and navigate around obstacles autonomously.
* **Why it's cool**: Teaches basic motor control, sensor integration, feedback loops, and collision avoidance algorithms.

### 2. IoT Wi-Fi Smart Weather Station
* **Difficulty**: Intermediate
* **Estimated Cost**: $25 - $35
* **Core Controller**: ESP32
* **Summary**: A stationary climate monitor that reads temperature, humidity, and atmospheric pressure, then streams live telemetry to an online dashboard.
* **Why it's cool**: Demonstrates Wi-Fi communication, multi-sensor bus architectures (I2C/SPI), and IoT data pipelines.

### 3. 4-Degree-of-Freedom Robotic Arm
* **Difficulty**: Advanced
* **Estimated Cost**: $60 - $80
* **Core Controller**: Raspberry Pi Pico
* **Summary**: A tabletop mechanical arm articulated by 4 servo motors, controlled via dual analog joysticks, capable of pick-and-place routines.
* **Why it's cool**: Explores forward/inverse kinematics, multi-servo duty cycle calibration, and analog signal filtering.
    `,

    COMPONENTS: `
# Bill of Materials: Smart Obstacle-Avoiding Car
*[MCP: google-developer-docs connected — referencing official datasheets]*

| Component | Qty | Est. Price (USD) | Primary Purpose | Alternative Option |
| :--- | :--- | :--- | :--- | :--- |
| - [ ] Arduino Uno R3 Board | 1 | $15.00 | Main microcontroller | Funduino Clone ($6.00) |
| - [ ] L298N Motor Driver Module | 1 | $5.00 | Motor power & direction | L9110S Dual Channel ($2.50) |
| - [ ] HC-SR04 Ultrasonic Sensor | 1 | $3.00 | Obstacle distance scanning | GP2Y0A21YK0F IR Sensor ($8.00) |
| - [ ] SG90 Micro Servo Motor | 1 | $2.50 | Rotate sensor left/right | MG90S Metal Gear ($4.50) |
| - [ ] Smart Car Chassis Kit | 1 | $12.00 | Structural body & propulsion | Custom 3D Printed Chassis |
| - [ ] 18650 Battery Holder + 2x Cells | 1 | $8.00 | High capacity power source | 4x AA Battery Pack |
| - [ ] Breadboard & Jumper Wires | 1 | $4.00 | Connection testing | Soldering directly |

### Total Estimated Budget: **$49.50**

### Sourcing Tips:
1. **Buy in Bundles**: Car kits bundle chassis, motors, and tires — saves ~30%.
2. **Battery Safety**: Always buy *protected* 18650 cells and use a balanced charger.
3. **Alternative Sourcing**: AliExpress clones can reduce costs to under $30.
    `,

    BUILD: `
# Assembly Guide: HC-SR04 Ultrasonic Sensor
*[MCP: google-developer-docs connected — referencing official Arduino pinout]*

## Wiring Map
* **HC-SR04 VCC** → Arduino **5V**
* **HC-SR04 Trig** → Arduino **Pin 9**
* **HC-SR04 Echo** → Arduino **Pin 10**
* **HC-SR04 GND** → Arduino **GND**

> [!WARNING]
> Always disconnect USB and battery before making wire connections.

## Arduino Starter Code

\`\`\`cpp
const int trigPin = 9;
const int echoPin = 10;
long duration;
int distance;

void setup() {
  pinMode(trigPin, OUTPUT);
  pinMode(echoPin, INPUT);
  Serial.begin(9600);
}

void loop() {
  digitalWrite(trigPin, LOW);
  delayMicroseconds(2);
  digitalWrite(trigPin, HIGH);
  delayMicroseconds(10);
  digitalWrite(trigPin, LOW);
  duration = pulseIn(echoPin, HIGH);
  distance = duration * 0.034 / 2;
  Serial.print("Distance: ");
  Serial.print(distance);
  Serial.println(" cm");
  delay(150);
}
\`\`\`
    `,

    TROUBLESHOOTING: `
# Diagnostic Report: Servo Motor Twitching
*[MCP: google-developer-docs connected — referencing official troubleshooting guides]*

## Root Causes (by probability)
1. **Insufficient Current**: Arduino 5V pin sources only ~200mA. SG90 draws 500mA+ under load.
2. **Missing Common Ground**: External battery GND not connected to Arduino GND.
3. **PWM Signal Noise**: Rapid loops without proper delays causing erratic signals.

## Diagnostic Checklist
- [ ] Move Servo VCC from Arduino 5V to external 5-6V power source
- [ ] Connect external battery GND directly to Arduino GND pin
- [ ] Measure voltage with multimeter — must stay above 4.8V during motion
- [ ] Upload minimal sweep sketch to isolate software bugs

\`\`\`
[ External 5V Battery ]
  (+) → Servo Red (VCC)
  (-) → Servo Brown (GND) + Arduino GND

[ Arduino ]
  Pin 9 → Servo Orange (Signal)
\`\`\`
    `
  }
};
