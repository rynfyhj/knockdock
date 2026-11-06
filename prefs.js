// loosely based on JustPerfection & Blur-My-Shell
'use strict';

import Gdk from 'gi://Gdk';
import Gtk from 'gi://Gtk';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Adw from 'gi://Adw';

const GETTEXT_DOMAIN = 'knockdock';

import { schemaId, SettingsKeys } from './preferences/keys.js';
import { MonitorsConfig } from './monitors.js';
import {
  RESET_DEFAULTS_FILE,
  applySettingsSnapshot,
  captureSettings,
  readSettingsSnapshot,
} from './preferences/resetDefaults.js';

import {
  ExtensionPreferences,
  gettext as _,
} from './preferences/extensionPreferences.js';
import { dlog, configPath, tempPath } from './utils.js';

export default class Preferences extends ExtensionPreferences {
  constructor(metadata) {
    super(metadata);

    let iconTheme = Gtk.IconTheme.get_for_display(Gdk.Display.get_default());
    let UIFolderPath = `${this.path}/ui`;
    iconTheme.add_search_path(`${UIFolderPath}/icons`);
    // ExtensionUtils.initTranslations();
  }

  find(n, name) {
    if (n.get_name() == name) {
      return n;
    }
    let c = n.get_first_child();
    while (c) {
      let cn = this.find(c, name);
      if (cn) {
        return cn;
      }
      c = c.get_next_sibling();
    }
    return null;
  }

  dump(n, l) {
    let s = '';
    for (let i = 0; i < l; i++) {
      s += ' ';
    }
    print(`${s}${n.get_name()}`);
    let c = n.get_first_child();
    while (c) {
      this.dump(c, l + 1);
      c = c.get_next_sibling();
    }
  }

  addMenu(window, builder) {
  }

  updateFolders(window, builder, settings) {
    let row = builder.get_object('downloads-folder-row');
    if (!row) return;
    let val = settings.get_string('downloads-path') || '';
    let fallback =
      GLib.get_user_special_dir(GLib.UserDirectory.DIRECTORY_DOWNLOAD) ||
      GLib.build_filenamev([GLib.get_home_dir(), 'Downloads']);
    let valid = false;
    if (val) {
      try {
        valid = Gio.File.new_for_path(val).query_exists(null);
      } catch (err) {
        valid = false;
      }
    }
    row.title = _('Downloads Folder');
    row.subtitle = valid ? val : `${_('System default')}: ${fallback}`;
  }

  async selectFolder(window, builder, settings, target) {
    const dialog = new Gtk.FileDialog();
    dialog.select_folder(window, null, (dialog, task) => {
      let folder = dialog.select_folder_finish(task);
      if (folder instanceof Gio.File) {
        let path = folder.get_path();
        dlog(`${target} = ${path}`);
        settings.set_string(target, path);
        this.updateFolders(window, builder, settings);
      } else {
        dlog('No valid folder selected.');
      }
    });
    return null;
  }

  addButtonEvents(window, builder, settings) {
    // builder.get_object('static-animation').connect('clicked', () => {
    //   builder.get_object('animation-spread').set_value(0);
    //   builder.get_object('animation-rise').set_value(0);
    //   builder.get_object('animation-magnify').set_value(0);
    // });

    if (builder.get_object('downloads-folder')) {
      builder.get_object('downloads-folder').connect('clicked', () => {
        this.selectFolder(window, builder, settings, 'downloads-path')
          .then((path) => {
            if (path) this.updateFolders(window, builder, settings);
          })
          .catch((err) => {
            dlog(err);
          });
      });
      settings.connect('changed::downloads-path', () => {
        this.updateFolders(window, builder, settings);
      });
      this.updateFolders(window, builder, settings);
    }

    if (builder.get_object('reset')) {
      builder.get_object('reset').connect('clicked', () => {
        let snapshot =
          readSettingsSnapshot(configPath(RESET_DEFAULTS_FILE)) ||
          readSettingsSnapshot(`${this.path}/${RESET_DEFAULTS_FILE}`);

        if (snapshot) {
          applySettingsSnapshot(settings, snapshot);
        } else {
          settings.list_keys().forEach((k) => {
            settings.reset(k);
          });
        }

        this._settingsKeys?.refresh();
        this.window?.add_toast(
          new Adw.Toast({
            title: snapshot
              ? _('Settings restored to saved defaults')
              : _('Settings reset to defaults'),
          })
        );
      });
    }
  }

  _spawnStandalone(window) {
    try {
      let launcher = new Gio.SubprocessLauncher({
        flags: Gio.SubprocessFlags.NONE,
      });
      launcher.setenv('KNOCKDOCK_PREFS_STANDALONE', '1', true);
      let gjs = GLib.find_program_in_path('gjs') || '/usr/bin/gjs';
      launcher.spawnv([gjs, '-m', `${this.path}/prefs-standalone.js`]);
    } catch (err) {
      logError(err);
      return false;
    }

    return true;
  }

  fillPreferencesWindow(window) {
    if (
      !GLib.getenv('KNOCKDOCK_PREFS_STANDALONE') &&
      this._spawnStandalone(window)
    ) {
      window.set_opacity(0);
      window.add(new Adw.PreferencesPage());
      window.connect('map', () => {
        GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
          try {
            window.close();
          } catch (err) {
            logError(err);
          }
          return GLib.SOURCE_REMOVE;
        });
      });
      return;
    }

    window.set_modal(false);
    window.set_default_size(800, 600);
    window.set_size_request(640, 480);
    // dlog(`>>${window.get_content()}`);
    let builder = new Gtk.Builder();
    this._builder = builder;

    let UIFolderPath = `${this.path}/ui`;
    builder.add_from_file(`${UIFolderPath}/general.ui`);
    builder.add_from_file(`${UIFolderPath}/appearance.ui`);
    builder.add_from_file(`${UIFolderPath}/tweaks.ui`);
    builder.add_from_file(`${UIFolderPath}/effects.ui`);
    builder.add_from_file(`${UIFolderPath}/others.ui`);
    window.add(builder.get_object('general'));
    window.add(builder.get_object('appearance'));
    window.add(builder.get_object('tweaks'));
    window.add(builder.get_object('effects'));
    window.add(builder.get_object('others'));
    window.set_search_enabled(true);

    // this.dump(window, 0);



    let settings = this.getSettings(schemaId);
    settings.set_string('msg-to-ext', '');

    let settingsKeys = SettingsKeys({
      _toRGBA: function (rgba) {
        return new Gdk.RGBA(rgba);
      }
    });
    settingsKeys.connectBuilder(builder);
    settingsKeys.connectSettings(settings);

    this._settings = settings;
    this._settingsKeys = settingsKeys;

    this.addButtonEvents(window, builder, settings);
    this.addMenu(window, builder);

    if (builder.get_object('peek-hidden-icons-row')) {
      builder.get_object('peek-hidden-icons-row').visible = false;
    }

    this._monitorsConfig = new MonitorsConfig();
    this._monitorsConfig.connect('updated', () => this.updateMonitors());

    window.connect('close-request', () => {
      try { this._monitorsConfig?.destroy?.(); } catch (e) {}
      this._monitorsConfig = null;
      this._builder = null;
      return false;
    });
    // settings.connect('changed::preferred-monitor', () => this.updateMonitors());

    this._themed_presets = [];
    this.preloadPresets(`${this.path}/themes`);
    this.preloadPresets(configPath('themes'));
    this._buildThemesMenu(window);
    this.updateMonitors();

    this.window = window;
  }

  preloadPresets(themes_path) {
    let dir = Gio.File.new_for_path(themes_path);
    if (!dir.query_exists(null)) {
      return;
    }
    let iter = dir.enumerate_children(
      'standard::*',
      Gio.FileQueryInfoFlags.NONE,
      null
    );

    let themed_presets = [];
    let f = iter.next_file(null);
    while (f) {
      let fn = Gio.File.new_for_path(`${themes_path}/${f.get_name()}`);
      try {
        if (fn.query_exists(null)) {
          const [success, contents] = fn.load_contents(null);
          if (success) {
            const decoder = new TextDecoder();
            let contentsString = decoder.decode(contents);
            let json = JSON.parse(contentsString);
            if (json && json['meta'] && json['meta']['title']) {
              themed_presets.push(json);
            }
          }
        }
      } catch (err) {
        dlog(`KnockDock: could not load theme ${fn.get_path()}: ${err}`);
      }
      f = iter.next_file(null);
    }
    this._themed_presets = [...this._themed_presets, ...themed_presets];
  }

  _buildThemesMenu(window) {
    this._themed_presets.push({
      meta: { title: _('Import...') },
      _menu_action: 'import',
    });
    this._themed_presets.push({
      meta: { title: _('Export...') },
      _menu_action: 'export',
    });

    const actionGroup = new Gio.SimpleActionGroup();
    window.insert_action_group('themes', actionGroup);

    let theme = this._builder.get_object('theme');
    if (!theme) return;
    let model = new Gio.Menu();
    this._themed_presets.forEach((preset, idx) => {
      let action_name = `set_theme-${idx}`;
      let act = new Gio.SimpleAction({ name: action_name });
      act.connect('activate', () => {
        switch (preset._menu_action) {
          case 'import':
            this.importTheme(window);
            break;
          case 'export':
            this.exportTheme();
            break;
          default:
            this.loadPreset(idx);
            break;
        }
      });
      actionGroup.add_action(act);
      model.append(preset['meta']['title'], `themes.${action_name}`);
    });
    theme.set_menu_model(model);
  }

  exportTheme() {
    let snapshot = captureSettings(this._settings);
    delete snapshot['msg-to-ext'];
    delete snapshot['msg-to-pref'];

    let data = {
      meta: {
        title: _('My Theme'),
        format: 'knockdock-theme',
        version: 1,
      },
      settings: snapshot,
    };

    let exportPath = tempPath('theme.json');
    let fn = Gio.File.new_for_path(exportPath);
    let content = JSON.stringify(data, null, 4);
    try {
      fn.replace_contents(
        content,
        null,
        false,
        Gio.FileCreateFlags.REPLACE_DESTINATION,
        null
      );
    } catch (err) {
      this.window?.add_toast(
        new Adw.Toast({ title: `${_('Export failed')}: ${err.message}` })
      );
      return;
    }

    let noticeRow = this._builder.get_object('theme-export-path');
    if (noticeRow) {
      noticeRow.subtitle = `${_('Saved to')} ${exportPath}. ${_(
        'Use Import... to load it again, or copy it to'
      )} ${configPath('themes')}.`;
    }

    this.window?.add_toast(
      new Adw.Toast({ title: `${_('Saved to')} ${exportPath}` })
    );

    let notice = this._builder.get_object('theme-export-notice');
    if (notice) notice.visible = true;
  }

  importTheme(window) {
    let dialog = new Gtk.FileDialog({
      title: _('Import Theme'),
      modal: true,
    });
    let filter = new Gtk.FileFilter();
    filter.set_name(_('JSON Files'));
    filter.add_suffix('json');
    dialog.set_default_filter(filter);

    dialog.open(window, null, (d, task) => {
      let file;
      try {
        file = d.open_finish(task);
      } catch (err) {
        return;
      }
      if (!(file instanceof Gio.File)) return;

      let data = readSettingsSnapshot(file.get_path());
      if (!data) {
        this.window?.add_toast(
          new Adw.Toast({ title: _('Could not read theme file') })
        );
        return;
      }

      let count = this.applyThemeData(data);
      if (!count) {
        this.window?.add_toast(
          new Adw.Toast({ title: _('No settings found in theme file') })
        );
        return;
      }

      this.window?.add_toast(
        new Adw.Toast({
          title: `${_('Imported')} ${count} ${_('settings')}`,
        })
      );
    });
  }

  applyThemeData(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) return 0;

    let count = 0;
    if (
      data.settings &&
      typeof data.settings === 'object' &&
      !Array.isArray(data.settings)
    ) {
      let snapshot = {};
      Object.keys(data.settings).forEach((name) => {
        if (name === 'msg-to-ext' || name === 'msg-to-pref') return;
        snapshot[name] = data.settings[name];
      });
      count = Object.keys(snapshot).length;
      applySettingsSnapshot(this._settings, snapshot);
    } else {
      Object.keys(data).forEach((name) => {
        if (name === 'meta') return;
        let value = data[name];
        let def = this._settingsKeys.getKey(name);
        if (!def) return;

        try {
          switch (def.widget_type) {
            case 'color':
              this._settings.set_value(
                name,
                new GLib.Variant('(dddd)', value)
              );
              break;
            case 'switch':
              this._settings.set_boolean(name, value);
              break;
            case 'dropdown':
              this._settings.set_int(name, value);
              break;
            case 'scale':
              this._settings.set_double(name, value);
              break;
            case 'string':
              this._settings.set_string(name, `${value}`);
              break;
            case 'json_array':
              this._settings.set_string(name, JSON.stringify(value));
              break;
            default:
              return;
          }
          count++;
        } catch (err) {
          dlog(`KnockDock: could not import ${name}: ${err}`);
        }
      });
    }

    this._settingsKeys?.refresh();
    if (this.window) {
      this.updateFolders(this.window, this._builder, this._settings);
    }
    this.updateMonitors();
    return count;
  }

  loadPreset(i) {
    let preset = this._themed_presets[i];
    if (!preset?.['meta']?.['title']) return;

    this.applyThemeData(preset);
    this.window?.add_toast(
      new Adw.Toast({ title: `${preset['meta']['title']}` })
    );
  }

  updateMonitors() {
    let monitors = this._monitorsConfig.monitors;
    let primary = this._monitorsConfig.primaryMonitor;
    let active = monitors.filter((m) => m.active);
    let ordered = [];
    if (primary) ordered.push(primary);
    active.forEach((m) => {
      if (m !== primary) ordered.push(m);
    });
    if (!ordered.length) return;

    let list = new Gtk.StringList();
    let maps = {};
    ordered.forEach((m, index) => {
      list.append(index === 0 ? _('Primary Monitor') : m.displayName);
      maps[index] = m.index;
    });

    let dropdown = this._builder.get_object('preferred-monitor');
    let key = this._settingsKeys?.getKey('preferred-monitor');
    if (key) key.maps = maps;
    dropdown.set_model(list);

    let current = this._settings?.get_int('preferred-monitor') || 0;
    let primaryIndex = primary ? primary.index : 0;
    let selected = 0;
    if (current !== 0 && current !== primaryIndex) {
      let match = Object.keys(maps).find(
        (modelIndex) => maps[modelIndex] === current
      );
      if (match !== undefined) selected = parseInt(match);
    }
    dropdown.set_selected(selected);
  }
}
