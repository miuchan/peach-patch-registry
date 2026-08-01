#pragma once

// Native file dialogs have no browser equivalent inside an isolated module.
// The host exposes file/sample selection separately, so legacy dialog calls
// remain safe no-ops while their DSP and serialization paths stay portable.
struct osdialog_filters {};
enum osdialog_file_action { OSDIALOG_OPEN, OSDIALOG_SAVE };
enum osdialog_message_level { OSDIALOG_INFO, OSDIALOG_WARNING, OSDIALOG_ERROR };
enum osdialog_message_buttons { OSDIALOG_OK, OSDIALOG_OK_CANCEL, OSDIALOG_YES_NO };

inline osdialog_filters* osdialog_filters_parse(const char*) { return nullptr; }
inline void osdialog_filters_free(osdialog_filters*) {}
inline char* osdialog_file(osdialog_file_action, const char*, const char*, osdialog_filters*) { return nullptr; }
inline int osdialog_message(osdialog_message_level, osdialog_message_buttons, const char*) { return 0; }
inline char* osdialog_prompt(int, const char*, const char*) { return nullptr; }
#ifndef OSDIALOG_FREE
#define OSDIALOG_FREE(path) do { (void)(path); } while (0)
#endif
