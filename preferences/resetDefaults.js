'use strict';

import GLib from 'gi://GLib';
import Gio from 'gi://Gio';

export const RESET_DEFAULTS_FILE = 'reset-defaults.json';

export function captureSettings(settings) {
  let snapshot = {};
  settings.list_keys().forEach((name) => {
    let variant = settings.get_value(name);
    snapshot[name] = {
      type: variant.get_type_string(),
      value: variant.deepUnpack(),
    };
  });
  return snapshot;
}

export function writeSettingsSnapshot(settings, path) {
  try {
    GLib.mkdir_with_parents(GLib.path_get_dirname(path), 0o755);
    let content = JSON.stringify(captureSettings(settings), null, 2);
    Gio.File.new_for_path(path).replace_contents(
      content,
      null,
      false,
      Gio.FileCreateFlags.REPLACE_DESTINATION,
      null
    );
    return true;
  } catch (err) {
    console.log(`knockdock: failed to write reset defaults: ${err}`);
    return false;
  }
}

export function readSettingsSnapshot(path) {
  try {
    let [ok, contents] = GLib.file_get_contents(path);
    if (!ok) return null;
    let snapshot = JSON.parse(new TextDecoder().decode(contents));
    return snapshot && typeof snapshot === 'object' ? snapshot : null;
  } catch (err) {
    return null;
  }
}

const IGNORED_KEYS = new Set(['msg-to-ext', 'msg-to-pref']);

export function applySettingsSnapshot(settings, snapshot) {
  if (!snapshot) return false;

  let keys = settings.list_keys();
  Object.keys(snapshot).forEach((name) => {
    if (IGNORED_KEYS.has(name) || !keys.includes(name)) return;
    let entry = snapshot[name];
    if (!entry || typeof entry.type !== 'string' || !('value' in entry)) return;
    try {
      settings.set_value(name, new GLib.Variant(entry.type, entry.value));
    } catch (err) {
      console.log(`knockdock: failed to restore ${name}: ${err}`);
    }
  });
  return true;
}
