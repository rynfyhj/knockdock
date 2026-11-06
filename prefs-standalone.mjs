#!/usr/bin/env -S gjs -m
'use strict';

import { dlog } from './utils.js';

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Adw from 'gi://Adw';

const EXTENSION_DIR = Gio.File.new_for_uri(import.meta.url)
  .get_parent()
  .get_path();
const UUID = GLib.path_get_basename(EXTENSION_DIR);

// Only run when explicitly invoked as a standalone process. When this module
// is merely imported (e.g. for EGO reachability), do nothing.
if (GLib.getenv('KNOCKDOCK_PREFS_STANDALONE') === '1') {
  const { default: Preferences } = await import('./prefs.js');

  const app = new Adw.Application({
    application_id: 'local.casper.KnockDock.Preferences',
    flags: Gio.ApplicationFlags.DEFAULT_FLAGS,
  });

  let prefsWindow = null;

  async function openPreferences() {
    if (prefsWindow) {
      prefsWindow.present();
      return;
    }

    const prefs = new Preferences({
      uuid: UUID,
      name: 'KnockDock',
      'settings-schema': 'org.gnome.shell.extensions.knockdock',
      'gettext-domain': 'knockdock',
      dir: Gio.File.new_for_path(EXTENSION_DIR),
      path: EXTENSION_DIR,
    });

    prefsWindow = new Adw.PreferencesWindow({
      application: app,
      title: 'KnockDock',
    });
    prefsWindow.set_default_size(800, 600);
    prefsWindow.set_size_request(640, 480);
    prefsWindow.connect('close-request', () => {
      prefsWindow = null;
      return false;
    });

    await prefs.fillPreferencesWindow(prefsWindow);
    prefsWindow.present();
  }

  app.connect('activate', () => {
    openPreferences().catch((err) => {
      dlog(err);
      app.quit();
    });
  });

  app.run([]);
}