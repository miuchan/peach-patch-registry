// Automatically isolated from the original Rack DSP module for Biset/Biset-Blank.
// Source: https://github.com/gibbonjoyeux/VCV-Biset (src/Blank/Blank.hpp; registered in src/Blank/Blank.cpp)
// License: GPL-3.0-or-later

#include "rack_web_export.hpp"
#define BLANK_BUFFER					2048
#define BLANK_DIST_MAX					300.0
#define BLANK_PRECISION					128
#define BLANK_PRECISION_SCOPE			256
#define BLANK_CABLES					256
#define BLANK_SCOPE_LABEL_BUFFER		128	// "X output to Y input\0"
#define BLANK_SCOPE_LABEL				55	// (128 - 18) / 2

#define BLANK_CABLE_POLY_FIRST			0
#define BLANK_CABLE_POLY_SUM			1
#define BLANK_CABLE_POLY_SUM_DIVIDED	2

#define BLANK_SCOPE_TOP_LEFT			0
#define BLANK_SCOPE_TOP_RIGHT			1
#define BLANK_SCOPE_BOTTOM_LEFT			2
#define BLANK_SCOPE_BOTTOM_RIGHT		3
#define BLANK_SCOPE_CENTER				4
#define BLANK_SCOPE_CIRCULAR			0
#define BLANK_SCOPE_LINEAR				1
#define BLANK_CABLE_INCOMPLETE_OFF		0
#define BLANK_CABLE_INCOMPLETE_IN		1
#define BLANK_CABLE_INCOMPLETE_OUT		2

////////////////////////////////////////////////////////////////////////////////
/// DATA STRUCTURE
////////////////////////////////////////////////////////////////////////////////

struct BlankCable;
struct Blank;
struct BlankWidget;
struct BlankCables;
struct BlankScope;;

struct Blank : Module {
	enum	ParamIds {
		PARAM_CABLE_ENABLED,
		PARAM_CABLE_BRIGHTNESS,		// Cable impacted by brightness
		PARAM_CABLE_LIGHT,			// Cable plug light
		PARAM_CABLE_POLY_THICK,		// Polyphonic cables thicker
		PARAM_CABLE_POLY_MODE,		// Polyphonic cables behavior (1st or sum)
		PARAM_CABLE_FAST,			// Cable animation computation mode
		PARAM_CABLE_SLEW,			// Cable animation slew limiter
		PARAM_CABLE_SCALE,			// Cable animation scale

		PARAM_SCOPE_ENABLED,
		PARAM_SCOPE_MAJ,			// Scope appears only with MAJ pressed
		PARAM_SCOPE_MODE,			// Scope display mode (circular / redraw)
		PARAM_SCOPE_POSITION,		// Scope position mode
		PARAM_SCOPE_SCALE,			// Scope scale
		PARAM_SCOPE_THICKNESS,		// Scope line thickness
		PARAM_SCOPE_BACK_ALPHA,		// Scope background alpha
		PARAM_SCOPE_VOLT_ALPHA,		// Scope voltage indicator alpha
		PARAM_SCOPE_LABEL_ALPHA,	// Scope port name alpha
		PARAM_SCOPE_ALPHA,			// Scope alpha

		PARAM_PANEL,

		PARAM_COUNT
	};
	enum	InputIds {
		INPUT_COUNT
	};
	enum	OutputIds {
		OUTPUT_COUNT
	};
	enum	LightIds {
		LIGHT_COUNT
	};

	int				cable_count;
	int				cable_incomplete;
	BlankCable		cables[BLANK_CABLES + 1];
	int				buffer_i;

	int				scope_index;

	char			scope_label[BLANK_SCOPE_LABEL_BUFFER];

	Blank();
	~Blank();
	void processBypass(const ProcessArgs& args) override;
	void process(const ProcessArgs& args) override;

public:
  static constexpr int rackWebParamCount = 19;
  static constexpr int rackWebInputCount = 0;
  static constexpr int rackWebOutputCount = 0;
  static constexpr int rackWebLightCount = 0;
  static constexpr int NUM_PARAMS = PARAM_COUNT;
  static constexpr int NUM_INPUTS = INPUT_COUNT;
  static constexpr int NUM_OUTPUTS = OUTPUT_COUNT;
  static constexpr int NUM_LIGHTS = LIGHT_COUNT;
};
Blank::Blank(void) {
	config(PARAM_COUNT, INPUT_COUNT, OUTPUT_COUNT, LIGHT_COUNT);

	configSwitch(PARAM_SCOPE_ENABLED, 0, 1, 1);
	configSwitch(PARAM_SCOPE_MAJ, 0, 1, 0);
	configSwitch(PARAM_SCOPE_MODE, 0, 1, 0);
	configSwitch(PARAM_SCOPE_POSITION, 0, 4, 0);
	configParam(PARAM_SCOPE_SCALE, 0.02, 1, 0.2, "Scope scale", "%", 0, 100);
	configParam(PARAM_SCOPE_THICKNESS, 1, 10, 2, "Scope thickness", "");
	configParam(PARAM_SCOPE_BACK_ALPHA, 0, 1, 0.6, "Scope background alpha", "%", 0, 100);
	configParam(PARAM_SCOPE_VOLT_ALPHA, 0, 1, 0.3, "Scope voltage alpha", "%", 0, 100);
	configParam(PARAM_SCOPE_LABEL_ALPHA, 0, 1, 1, "Scope label alpha", "%", 0, 100);
	configParam(PARAM_SCOPE_ALPHA, 0, 1, 1, "Scope alpha", "%", 0, 100);

	configSwitch(PARAM_CABLE_ENABLED, 0, 1, 1);
	configSwitch(PARAM_CABLE_BRIGHTNESS, 0, 1, 1);
	configSwitch(PARAM_CABLE_LIGHT, 0, 1, 1);
	configSwitch(PARAM_CABLE_POLY_THICK, 0, 1, 1);
	configSwitch(PARAM_CABLE_POLY_MODE, 0, 2, 0);
	configSwitch(PARAM_CABLE_FAST, 0, 1, 0);
	configParam(PARAM_CABLE_SLEW, 0.0, 1.0, 0.0, "Cable slew", "%", 0, 100);
	configParam(PARAM_CABLE_SCALE, 0.0, 2.0, 1.0, "Cable scale", "%", 0, 100);

	configSwitch(PARAM_PANEL, 0, 3, 0);

	this->buffer_i = 0;



}

Blank::~Blank() { if (this == g_blank) g_blank = nullptr; }

void Blank::processBypass(const ProcessArgs&) {}

void Blank::process(const ProcessArgs&) { if (g_blank == nullptr) g_blank = this; }

template <> struct RackWebModuleTraits<Blank> { static constexpr int paramCount = 19; static constexpr int inputCount = 0; static constexpr int outputCount = 0; static constexpr int lightCount = 0; };
RACK_WEB_EXPORTS(Blank)
