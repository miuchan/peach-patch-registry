#!/usr/bin/env bash
set -euo pipefail

project_dir="$(cd "$(dirname "$0")/.." && pwd)"
mkdir -p "$project_dir/public/wasm"
node "$project_dir/scripts/generate-web-runtime-manifest.mjs" >/dev/null

build_plugin(){
  local source="$1" output="$2" initial_memory="${3:-1048576}"
  em++ "$project_dir/web-runtime/plugins/$source.cpp" -I"$project_dir/web-runtime/include" -std=c++20 -O3 -flto \
    -s STANDALONE_WASM=1 -s ALLOW_MEMORY_GROWTH=0 -s INITIAL_MEMORY="$initial_memory" \
    -s EXPORTED_FUNCTIONS='["_rack_web_param_count","_rack_web_input_count","_rack_web_output_count","_rack_web_light_count","_rack_web_max_channels","_rack_web_input_buffer","_rack_web_output_buffer","_rack_web_light_buffer","_rack_web_set_param","_rack_web_get_param","_rack_web_get_param_min","_rack_web_get_param_max","_rack_web_set_input_connected","_rack_web_set_output_connected","_rack_web_set_input_channels","_rack_web_get_output_channels","_rack_web_set_polyphony","_rack_web_set_state","_rack_web_state_buffer","_rack_web_commit_state_json","_rack_web_snapshot_state_json","_rack_web_snapshot_state_buffer","_rack_web_trigger_action","_rack_web_midi_push","_rack_web_midi_output_available","_rack_web_midi_output_buffer","_rack_web_consume_midi_output","_rack_web_midi_packet_output_available","_rack_web_midi_packet_output_buffer","_rack_web_consume_midi_packet_output","_rack_web_asset_capacity","_rack_web_asset_buffer","_rack_web_commit_asset","_rack_web_capture_capacity","_rack_web_capture_buffer","_rack_web_capture_frames","_rack_web_capture_channels","_rack_web_capture_active","_rack_web_consume_capture","_rack_web_set_capture_enabled","_rack_web_seed","_rack_web_process"]' \
    --no-entry -o "$project_dir/public/wasm/$output.wasm"
}

count=0
while IFS=$'\t' read -r source output initial_memory key strategy package_artifact; do
  echo "Building $key"
  if [[ "$strategy" == "direct-rack-source-adapter" ]]; then
    cp "$project_dir/$package_artifact" "$project_dir/public/wasm/$output.wasm"
  else
    build_plugin "$source" "$output" "$initial_memory"
  fi
  count=$((count+1))
done < <(node "$project_dir/scripts/read-web-runtime-manifest.mjs" "$@")
echo "Built $count Rack Web plugin module(s)"
