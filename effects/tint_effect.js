// Adapted from Blur-My-Shell

'use strict';

import Shell from 'gi://Shell';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Clutter from 'gi://Clutter';

const getTintShaderSource = (extensionDir) => {
    const SHADER_PATH = GLib.build_filenamev([
        extensionDir,
        'effects',
        'tint_effect.glsl',
    ]);

    try {
        return Shell.get_file_contents_utf8_sync(SHADER_PATH);
    } catch (e) {
        return null;
    }
};

export const TintEffect = GObject.registerClass(
    {
        Properties: {
            'red': GObject.ParamSpec.double(
                'red',
                'Red',
                'Red component',
                GObject.ParamFlags.READWRITE,
                0.0, 1.0,
                0.0
            ),
            'green': GObject.ParamSpec.double(
                'green',
                'Green',
                'Green component',
                GObject.ParamFlags.READWRITE,
                0.0, 1.0,
                0.0
            ),
            'blue': GObject.ParamSpec.double(
                'blue',
                'Blue',
                'Blue component',
                GObject.ParamFlags.READWRITE,
                0.0, 1.0,
                0.0
            ),
            'blend': GObject.ParamSpec.double(
                'blend',
                'Blend',
                'Blend factor',
                GObject.ParamFlags.READWRITE,
                0.0, 1.0,
                0.0
            ),
        },
    },
    class TintEffect extends Clutter.ShaderEffect {
        _init(params) {
            this._red = null;
            this._green = null;
            this._blue = null;
            this._blend = null;

            this._static = true;

            let _color = params.color;
            delete params.color;

            super._init(params);

            if (_color)
                this.color = _color;
        }

        preload(path) {
            this._source = getTintShaderSource(path);
            // GNOME 51 removed set_shader_source in favour of Cogl snippets.
            if (this._source && typeof this.set_shader_source === 'function')
                this.set_shader_source(this._source);

            this.update_enabled();
        }

        update_enabled() {
            this.set_enabled(this.blend > 0 && this._static);
        }

        get red() {
            return this._red;
        }

        set red(value) {
            if (this._red !== value) {
                this._red = value;
                this.set_uniform_value('red', parseFloat(this._red - 1e-6));
            }
        }

        get green() {
            return this._green;
        }

        set green(value) {
            if (this._green !== value) {
                this._green = value;
                this.set_uniform_value('green', parseFloat(this._green - 1e-6));
            }
        }

        get blue() {
            return this._blue;
        }

        set blue(value) {
            if (this._blue !== value) {
                this._blue = value;
                this.set_uniform_value('blue', parseFloat(this._blue - 1e-6));
            }
        }

        get blend() {
            return this._blend;
        }

        set blend(value) {
            if (this._blend !== value) {
                this._blend = value;
                this.set_uniform_value('blend', parseFloat(this._blend - 1e-6));
            }
            this.update_enabled();
        }

        set color(c) {
            this.red = c[0];
            this.green = c[1];
            this.blue = c[2];
            this.blend = c[3];
        }

        get color() {
            return [this.red, this.green, this.blue, this.blend];
        }

        vfunc_paint_target(paint_node = null, paint_context = null) {
            this.set_uniform_value("tex", 0);
            super.vfunc_paint_target(paint_node, paint_context);
        }
    }
);
