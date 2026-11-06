#!/usr/bin/env -S gjs -m
import { dlog } from '../utils.js';

import Gtk from 'gi://Gtk?version=4.0';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

// Only run when explicitly invoked as a standalone process.
if (GLib.getenv('KNOCKDOCK_RECENTS') === '1') {
  let limit = 40;
  const recents = Gtk.RecentManager.get_default();
  let items = recents.get_items();

  let fn = Gio.File.new_for_path('/tmp/recents.txt');
  let content = '';
  for (let i = 0; i < limit && i < items.length; i++) {
    let item = items[i];
    if (item.exists()) {
      const uri = item.get_uri();
      const file = Gio.File.new_for_uri(uri);
      const fileInfo = file.query_info(
        'standard::*,unix::uid',
        Gio.FileQueryInfoFlags.NOFOLLOW_SYMLINKS,
        null
      );
      const icon = fileInfo.get_icon().get_names()[0] ?? 'folder';
      content += `${file.get_path()}|${icon}\n`;
    }
  }

  const [, etag] = fn.replace_contents(
    content,
    null,
    false,
    Gio.FileCreateFlags.REPLACE_DESTINATION,
    null
  );
}