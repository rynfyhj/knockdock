'use strict';

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

export const gettext = (str) => GLib.dgettext('knockdock', str);
export const ngettext = (str, strPlural, n) =>
  GLib.dngettext('knockdock', str, strPlural, n);
export const pgettext = (context, str) =>
  GLib.dpgettext2('knockdock', context, str);

export class ExtensionPreferences {
  constructor(metadata) {
    if (!metadata) {
      throw new Error('ExtensionPreferences did not receive metadata');
    }
    this.metadata = metadata;
  }

  get uuid() {
    return this.metadata['uuid'];
  }

  get dir() {
    return this.metadata['dir'];
  }

  get path() {
    return this.metadata['path'];
  }

  getSettings(schema) {
    schema ||= this.metadata['settings-schema'];

    const schemaDir = this.dir.get_child('schemas');
    const defaultSource = Gio.SettingsSchemaSource.get_default();
    let schemaSource;

    if (schemaDir.query_exists(null)) {
      schemaSource = Gio.SettingsSchemaSource.new_from_directory(
        schemaDir.get_path(),
        defaultSource,
        false
      );
    } else {
      schemaSource = defaultSource;
    }

    const schemaObj = schemaSource.lookup(schema, true);
    if (!schemaObj) {
      throw new Error(
        `Schema ${schema} could not be found for extension ${this.uuid}. Please check your installation`
      );
    }

    return new Gio.Settings({ settings_schema: schemaObj });
  }
}
