/*
 * Magic lamp minimize/unminimize effect.
 */

'use strict';

import GObject from 'gi://GObject';
import Clutter from 'gi://Clutter';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

const MINIMIZE_EFFECT_NAME = 'knockdock-minimize-magic-lamp-effect';
const UNMINIMIZE_EFFECT_NAME = 'knockdock-unminimize-magic-lamp-effect';

export class MagicLamp {
  constructor(extension) {
    this.extension = extension;
    this._enabled = false;
    this._minimizeId = null;
    this._unminimizeId = null;
    this._originalShouldAnimateActor = null;
    this._originalCompletedMinimize = null;
    this._originalCompletedUnminimize = null;
  }

  get settings() {
    return this.extension._settings;
  }

  get effect() {
    return this.settings.get_int('magic-lamp-effect') === 1 ? 'sine' : 'default';
  }

  get duration() {
    return this.settings.get_double('magic-lamp-duration');
  }

  get xTiles() {
    return this.settings.get_double('magic-lamp-x-tiles');
  }

  get yTiles() {
    return this.settings.get_double('magic-lamp-y-tiles');
  }

  enable() {
    if (this._enabled) {
      return;
    }
    this._enabled = true;

    const wm = Main.wm;

    if (wm._shouldAnimateActor) {
      this._originalShouldAnimateActor = wm._shouldAnimateActor;
      wm._shouldAnimateActor = (actor, types) => {
        const stack = new Error().stack;
        if (
          stack &&
          (stack.indexOf('_minimizeWindow') !== -1 ||
            stack.indexOf('_unminimizeWindow') !== -1)
        ) {
          return false;
        }

        return this._originalShouldAnimateActor.call(wm, actor, types);
      };
    }

    if (wm._shellwm && wm._shellwm.completed_minimize) {
      this._originalCompletedMinimize = wm._shellwm.completed_minimize;
      wm._shellwm.original_completed_minimize = this._originalCompletedMinimize;
      wm._shellwm.completed_minimize = (actor) => {};
    }

    if (wm._shellwm && wm._shellwm.completed_unminimize) {
      this._originalCompletedUnminimize = wm._shellwm.completed_unminimize;
      wm._shellwm.original_completed_unminimize =
        this._originalCompletedUnminimize;
      wm._shellwm.completed_unminimize = (actor) => {};
    }

    this._minimizeId = global.window_manager.connect('minimize', (e, actor) => {
      if (!actor || !actor.meta_window) {
        return;
      }
      if (Main.overview && Main.overview.visible) {
        if (this._originalCompletedMinimize && wm._shellwm) {
          this._originalCompletedMinimize.call(wm._shellwm, actor);
        }
        return;
      }

      const icon = this.getIcon(actor);
      this.destroyActorEffect(actor);

      try {
        actor.add_effect_with_name(
          MINIMIZE_EFFECT_NAME,
          new MagicLampMinimizeEffect({
            icon,
            effect: this.effect,
            duration: this.duration,
            xTiles: this.xTiles,
            yTiles: this.yTiles,
          })
        );
      } catch (err) {
        if (this._originalCompletedMinimize && wm._shellwm) {
          this._originalCompletedMinimize.call(wm._shellwm, actor);
        }
      }
    });

    this._unminimizeId = global.window_manager.connect(
      'unminimize',
      (e, actor) => {
        if (!actor || !actor.meta_window) {
          return;
        }
        actor.show();

        if (Main.overview && Main.overview.visible) {
          if (this._originalCompletedUnminimize && wm._shellwm) {
            this._originalCompletedUnminimize.call(wm._shellwm, actor);
          }
          return;
        }

        const icon = this.getIcon(actor);
        this.destroyActorEffect(actor);

        try {
          actor.add_effect_with_name(
            UNMINIMIZE_EFFECT_NAME,
            new MagicLampUnminimizeEffect({
              icon,
              effect: this.effect,
              duration: this.duration,
              xTiles: this.xTiles,
              yTiles: this.yTiles,
            })
          );
        } catch (err) {
          if (this._originalCompletedUnminimize && wm._shellwm) {
            this._originalCompletedUnminimize.call(wm._shellwm, actor);
          }
        }
      }
    );
  }

  disable() {
    if (!this._enabled) {
      return;
    }
    this._enabled = false;

    if (this._minimizeId) {
      global.window_manager.disconnect(this._minimizeId);
      this._minimizeId = null;
    }
    if (this._unminimizeId) {
      global.window_manager.disconnect(this._unminimizeId);
      this._unminimizeId = null;
    }

    try {
      global.get_window_actors().forEach((actor) => {
        this.destroyActorEffect(actor);
      });
    } catch (e) {}

    const wm = Main.wm;

    if (this._originalShouldAnimateActor) {
      wm._shouldAnimateActor = this._originalShouldAnimateActor;
      this._originalShouldAnimateActor = null;
    }
    if (wm._shellwm) {
      if (this._originalCompletedMinimize) {
        wm._shellwm.completed_minimize = this._originalCompletedMinimize;
        if (wm._shellwm.original_completed_minimize === this._originalCompletedMinimize) {
          wm._shellwm.original_completed_minimize = null;
        }
        this._originalCompletedMinimize = null;
      }
      if (this._originalCompletedUnminimize) {
        wm._shellwm.completed_unminimize = this._originalCompletedUnminimize;
        if (wm._shellwm.original_completed_unminimize === this._originalCompletedUnminimize) {
          wm._shellwm.original_completed_unminimize = null;
        }
        this._originalCompletedUnminimize = null;
      }
    }
  }

  getIcon(actor) {
    try {
      const [success, icon] = actor.meta_window.get_icon_geometry();
      if (success && icon) {
        return icon;
      }
    } catch (e) {}

    if (this.extension.lamp_app_animation) {
      const dockIcon = this._getDockIcon(actor);
      if (dockIcon) {
        return dockIcon;
      }
    }

    return this._getOverviewDashIcon(actor);
  }

  _getDockIcon(actor) {
    const docks = this.extension.docks;
    if (!docks || docks.length === 0) {
      return null;
    }

    try {
      const monitorIndex = actor.meta_window.get_monitor();
      const monitor = Main.layoutManager.monitors[monitorIndex];
      if (!monitor) {
        return null;
      }

      const dock = docks.find((d) => d._monitorIndex === monitorIndex);
      if (!dock) {
        return { x: monitor.x, y: monitor.y, width: 0, height: 0 };
      }

      const pid = actor.get_meta_window() ? actor.get_meta_window().get_pid() : null;
      if (!pid || !dock.dash || !dock.dash._box) {
        return { x: monitor.x, y: monitor.y, width: 0, height: 0 };
      }

      let dashIcon = null;
      dock.dash._box
        .get_children()
        .filter(
          (dashElement) =>
            dashElement.child &&
            dashElement.child._delegate &&
            dashElement.child._delegate.app
        )
        .forEach((dashElement) => {
          try {
            const pids = dashElement.child._delegate.app.get_pids();
            if (pids && pids.indexOf(pid) >= 0) {
              let el = dashElement;
              if (el._renderer) {
                el = el._renderer;
              }
              const transformedPosition = el.get_transformed_position();
              if (transformedPosition && transformedPosition[0] && transformedPosition[1]) {
                dashIcon = {
                  x: transformedPosition[0],
                  y: transformedPosition[1],
                  width: 0,
                  height: 0,
                };
              }
            }
          } catch (e) {}
        });

      if (!dashIcon) {
        return { x: monitor.x, y: monitor.y, width: 0, height: 0 };
      }

      let sz = 0;
      try {
        sz = dock._preferredIconSize();
      } catch (e) {}
      let ofs = 0;
      if (sz) {
        try {
          const scale = dock.getMonitor().geometry_scale || 1;
          ofs = (sz / 2) * scale;
        } catch (e) {}
      }

      let x = dashIcon.x;
      let y = dashIcon.y;

      switch (dock._position) {
        case 'left':
          x = dock._monitor ? dock._monitor.x : monitor.x;
          y += ofs;
          break;
        case 'right':
          x = dock._monitor ? dock._monitor.x + dock._monitor.width : monitor.x + monitor.width;
          y += ofs;
          break;
        case 'top':
          y = dock._monitor ? dock._monitor.y : monitor.y;
          x += ofs;
          break;
        case 'bottom':
        default:
          y = dock._monitor ? dock._monitor.y + dock._monitor.height : monitor.y + monitor.height;
          x += ofs;
          break;
      }

      return { x, y, width: 0, height: 0 };
    } catch (e) {
      return null;
    }
  }

  _getOverviewDashIcon(actor) {
    try {
      const monitor = Main.layoutManager.monitors[actor.meta_window.get_monitor()];
      if (monitor && Main.overview && Main.overview.dash) {
        try {
          Main.overview.dash._redisplay();
        } catch (e) {}

        let dashIcon = null;
        const pid = actor.get_meta_window() ? actor.get_meta_window().get_pid() : null;
        if (pid && Main.overview.dash._box) {
          Main.overview.dash._box
            .get_children()
            .filter(
              (dashElement) =>
                dashElement.child &&
                dashElement.child._delegate &&
                dashElement.child._delegate.app
            )
            .forEach((dashElement) => {
              try {
                const pids = dashElement.child._delegate.app.get_pids();
                if (pids && pids.indexOf(pid) >= 0) {
                  const transformedPosition = dashElement.get_transformed_position();
                  if (transformedPosition && transformedPosition[0]) {
                    dashIcon = {
                      x: transformedPosition[0],
                      y: monitor.y + monitor.height,
                      width: 0,
                      height: 0,
                    };
                  }
                }
              } catch (e) {}
            });
        }
        if (dashIcon) {
          return dashIcon;
        }

        return {
          x: monitor.x + monitor.width / 2,
          y: monitor.y + monitor.height,
          width: 0,
          height: 0,
        };
      }
    } catch (e) {}

    return { x: 0, y: 0, width: 0, height: 0 };
  }

  destroyActorEffect(actor) {
    if (!actor) {
      return;
    }

    try {
      const minimizeEffect = actor.get_effect(MINIMIZE_EFFECT_NAME);
      if (minimizeEffect) {
        minimizeEffect.destroy();
      }
    } catch (e) {}

    try {
      const unminimizeEffect = actor.get_effect(UNMINIMIZE_EFFECT_NAME);
      if (unminimizeEffect) {
        unminimizeEffect.destroy();
      }
    } catch (e) {}
  }
}

class AbstractCommonMagicLampEffect extends Clutter.DeformEffect {
  static {
    GObject.registerClass(this);
  }

  _init(params = {}) {
    super._init();

    this.EPSILON = 40;

    this.isMinimizeEffect = false;
    this.newFrameEvent = null;
    this.completedEvent = null;

    this.timerId = null;
    this.msecs = 0;

    this.monitor = { x: 0, y: 0, width: 0, height: 0 };
    this.iconMonitor = { x: 0, y: 0, width: 0, height: 0 };
    this.window = { x: 0, y: 0, width: 0, height: 0, scale: 1 };
    this.icon = params.icon || { x: 0, y: 0, width: 0, height: 0 };

    this.progress = 0;
    this.split = 0.3;
    this.k = 0;
    this.j = 0;
    this.expandWidth = 0;
    this.fullWidth = 0;
    this.expandHeight = 0;
    this.fullHeight = 0;
    this.width = 0;
    this.height = 0;
    this.x = 0;
    this.y = 0;
    this.offsetX = 0;
    this.offsetY = 0;
    this.effectX = 0;
    this.effectY = 0;
    this.iconPosition = null;

    this.toTheBorder = true;
    this.maxIconSize = null;
    this.alignIcon = 'center';

    this.EFFECT = params.effect ?? 'default';
    this.DURATION = params.duration ?? 400;
    this.X_TILES = params.xTiles ?? 10;
    this.Y_TILES = params.yTiles ?? 10;

    this.initialized = false;
  }

  destroy_actor(actor) {}

  on_tick_elapsed(timer, msecs) {}

  vfunc_set_actor(actor) {
    try {
      super.vfunc_set_actor(actor);

      if (!this.actor || this.initialized) {
        return;
      }

      this.initialized = true;

      try {
        this.monitor =
          Main.layoutManager.monitors[actor.meta_window.get_monitor()] || Main.layoutManager.primaryMonitor;
      } catch (e) {
        this.monitor = { x: 0, y: 0, width: 1920, height: 1080 };
      }

      try {
        [this.window.x, this.window.y] = [
          this.actor.get_x() - this.monitor.x,
          this.actor.get_y() - this.monitor.y,
        ];
        [this.window.width, this.window.height] = actor.get_size();
      } catch (e) {
        this.window = { x: 0, y: 0, width: 800, height: 600, scale: 1 };
      }

      if (
        !this.icon ||
        (this.icon.x === 0 &&
          this.icon.y === 0 &&
          this.icon.width === 0 &&
          this.icon.height === 0)
      ) {
        this.icon.x = this.monitor.x + this.monitor.width / 2;
        this.icon.y = this.monitor.y + this.monitor.height;
      }

      try {
        Main.layoutManager.monitors.forEach((monitor, monitorIndex) => {
          let scale = 1;
          if (global.display && global.display.get_monitor_scale) {
            try {
              scale = global.display.get_monitor_scale(monitorIndex);
            } catch (e) {}
          }

          if (
            this.icon.x >= monitor.x &&
            this.icon.x <= monitor.x + monitor.width * scale &&
            this.icon.y >= monitor.y &&
            this.icon.y <= monitor.y + monitor.height * scale
          ) {
            this.iconMonitor = monitor;
          }
        });
      } catch (e) {}
      if (
        this.iconMonitor.x === 0 &&
        this.iconMonitor.y === 0 &&
        this.iconMonitor.width === 0 &&
        this.iconMonitor.height === 0
      ) {
        this.iconMonitor = this.monitor;
      }

      [this.icon.x, this.icon.y, this.icon.width, this.icon.height] = [
        this.icon.x - this.monitor.x,
        this.icon.y - this.monitor.y,
        this.icon.width,
        this.icon.height,
      ];

      if (this.icon.y + this.icon.height >= this.monitor.height - this.EPSILON) {
        this.iconPosition = St.Side.BOTTOM;
        if (this.toTheBorder) {
          this.icon.y = this.iconMonitor.y + this.iconMonitor.height - this.monitor.y;
          this.icon.height = 0;
        }
      } else if (this.icon.x <= this.EPSILON) {
        this.iconPosition = St.Side.LEFT;
        if (this.toTheBorder) {
          this.icon.x = this.iconMonitor.x - this.monitor.x;
          this.icon.width = 0;
        }
      } else if (this.icon.x + this.icon.width >= this.monitor.width - this.EPSILON) {
        this.iconPosition = St.Side.RIGHT;
        if (this.toTheBorder) {
          this.icon.x = this.iconMonitor.x + this.iconMonitor.width - this.monitor.x;
          this.icon.width = 0;
        }
      } else {
        this.iconPosition = St.Side.TOP;
        if (this.toTheBorder) {
          this.icon.y = this.iconMonitor.y - this.monitor.y;
          this.icon.height = 0;
        }
      }

      try {
        this.set_n_tiles(this.X_TILES, this.Y_TILES);
      } catch (e) {}

      const duration = Math.max(150, this.DURATION || 400);
      try {
        this.timerId = new Clutter.Timeline({
          actor: this.actor,
          duration,
        });
        this.newFrameEvent = this.timerId.connect(
          'new-frame',
          this.on_tick_elapsed.bind(this)
        );
        this.completedEvent = this.timerId.connect(
          'completed',
          this.destroy.bind(this)
        );
        this.timerId.start();
      } catch (e) {
        this.destroy();
      }
    } catch (e) {
      this.destroy();
    }
  }

  destroy() {
    try {
      if (this.timerId) {
        if (this.newFrameEvent) {
          try {
            this.timerId.disconnect(this.newFrameEvent);
          } catch (e) {}
          this.newFrameEvent = null;
        }
        if (this.completedEvent) {
          try {
            this.timerId.disconnect(this.completedEvent);
          } catch (e) {}
          this.completedEvent = null;
        }
        this.timerId = null;
      }

      const actor = this.get_actor();
      if (actor) {
        try {
          if (this.paintEvent) {
            actor.disconnect(this.paintEvent);
            this.paintEvent = null;
          }
        } catch (e) {}
        try {
          actor.remove_effect(this);
        } catch (e) {}

        try {
          this.destroy_actor(actor);
        } catch (e) {}
      }
    } catch (e) {}
  }

  vfunc_deform_vertex(w, h, v) {
    if (!this.initialized || !this.window.width || !this.window.height) {
      return;
    }
    try {
      const propX = w / this.window.width;
      const propY = h / this.window.height;

      if (this.iconPosition === St.Side.LEFT) {
        this.width = this.window.width - this.icon.width + this.window.x * this.k;

        this.x = (this.width - this.j * this.width) * v.tx;
        this.y =
          (v.ty * this.window.height * (this.x + (this.width - this.x) * (1 - this.k))) /
            this.width +
          (v.ty * this.icon.height * (this.width - this.x)) / this.width;

        this.offsetX = this.icon.width - this.window.x * this.k;
        this.offsetY =
          (this.icon.y - this.window.y) * ((this.width - this.x) / this.width) * this.k;

        if (this.EFFECT === 'sine') {
          this.effectY =
            (Math.sin((this.x / this.width) * Math.PI * 4) * this.window.height) / 14 * this.k;
        } else {
          this.effectY =
            (Math.sin((0.5 - (this.width - this.x) / this.width) * 2 * Math.PI) *
              (this.window.y + this.window.height * v.ty - (this.icon.y + this.icon.height * v.ty))) /
            7 *
            this.k;
        }
      } else if (this.iconPosition === St.Side.TOP) {
        this.height = this.window.height - this.icon.height + this.window.y * this.k;

        this.y = (this.height - this.j * this.height) * v.ty;
        this.x =
          (v.tx * this.window.width * (this.y + (this.height - this.y) * (1 - this.k))) /
            this.height +
          (v.tx * this.icon.width * (this.height - this.y)) / this.height;

        this.offsetX = (this.icon.x - this.window.x) * ((this.height - this.y) / this.height) * this.k;
        this.offsetY = this.icon.height - this.window.y * this.k;

        if (this.EFFECT === 'sine') {
          this.effectX =
            (Math.sin((this.y / this.height) * Math.PI * 4) * this.window.width) / 14 * this.k;
        } else {
          this.effectX =
            (Math.sin((0.5 - (this.height - this.y) / this.height) * 2 * Math.PI) *
              (this.window.x + this.window.width * v.tx - (this.icon.x + this.icon.width * v.tx))) /
            7 *
            this.k;
        }
      } else if (this.iconPosition === St.Side.RIGHT) {
        this.expandWidth = this.iconMonitor.width - this.icon.width - this.window.x - this.window.width;
        this.fullWidth = this.iconMonitor.width - this.icon.width - this.window.x - this.expandWidth * (1 - this.k);
        this.width = this.fullWidth - this.j * this.fullWidth;

        this.x = v.tx * this.width;
        this.y =
          v.ty * this.icon.height +
          v.ty * (this.window.height - this.icon.height) * (1 - this.j) * (1 - v.tx) +
          v.ty * (this.window.height - this.icon.height) * (1 - this.k) * v.tx;

        this.offsetY = (this.icon.y - this.window.y) * (this.x / this.fullWidth) * this.k + (this.icon.y - this.window.y) * this.j;
        this.offsetX = this.iconMonitor.width - this.icon.width - this.window.x - this.width - this.expandWidth * (1 - this.k);

        if (this.EFFECT === 'sine') {
          this.effectY =
            (Math.sin(((this.width - this.x) / this.fullWidth) * Math.PI * 4) * this.window.height) / 14 * this.k;
        } else {
          this.effectY =
            (Math.sin(((this.width - this.x) / this.fullWidth) * 2 * Math.PI + Math.PI) *
              (this.window.y + this.window.height * v.ty - (this.icon.y + this.icon.height * v.ty))) /
            7 *
            this.k;
        }
      } else if (this.iconPosition === St.Side.BOTTOM) {
        this.expandHeight = this.iconMonitor.height - this.icon.height - this.window.y - this.window.height;
        this.fullHeight = this.iconMonitor.height - this.icon.height - this.window.y - this.expandHeight * (1 - this.k);
        this.height = this.fullHeight - this.j * this.fullHeight;

        this.y = v.ty * this.height;
        this.x =
          v.tx * this.icon.width +
          v.tx * (this.window.width - this.icon.width) * (1 - this.j) * (1 - v.ty) +
          v.tx * (this.window.width - this.icon.width) * (1 - this.k) * v.ty;

        this.offsetX = (this.icon.x - this.window.x) * (this.y / this.fullHeight) * this.k + (this.icon.x - this.window.x) * this.j;
        this.offsetY = this.iconMonitor.height - this.icon.height - this.window.y - this.height - this.expandHeight * (1 - this.k);

        if (this.EFFECT === 'sine') {
          this.effectX =
            (Math.sin(((this.height - this.y) / this.fullHeight) * Math.PI * 4) * this.window.width) / 14 * this.k;
        } else {
          this.effectX =
            (Math.sin(((this.height - this.y) / this.fullHeight) * 2 * Math.PI + Math.PI) *
              (this.window.x + this.window.width * v.tx - (this.icon.x + this.icon.width * v.tx))) /
            7 *
            this.k;
        }
      }

      v.x = (this.x + this.offsetX + this.effectX) * propX;
      v.y = (this.y + this.offsetY + this.effectY) * propY;
    } catch (e) {}
  }
}

class MagicLampMinimizeEffect extends AbstractCommonMagicLampEffect {
  static {
    GObject.registerClass(this);
  }

  _init(params = {}) {
    super._init(params);

    this.k = 0;
    this.j = 0;
    this.isMinimizeEffect = true;
  }

  destroy_actor(actor) {
    try {
      if (Main.wm && Main.wm._shellwm && Main.wm._shellwm.original_completed_minimize) {
        Main.wm._shellwm.original_completed_minimize(actor);
        return;
      }
    } catch (e) {}
    try {
      actor.hide();
    } catch (e) {}
    try {
      if (actor.meta_window) {
        actor.meta_window.minimize();
      }
    } catch (e) {}
  }

  on_tick_elapsed(timer, msecs) {
    try {
      if (Main.overview && Main.overview.visible) {
        this.destroy();
        return;
      }

      this.progress = timer.get_progress();
      this.k = this.progress <= this.split ? this.progress * (1 / 1 / this.split) : 1;
      this.j = this.progress > this.split ? (this.progress - this.split) * (1 / 1 / (1 - this.split)) : 0;

      if (this.actor && this.actor.get_parent()) {
        this.actor.get_parent().queue_redraw();
      }
      this.invalidate();
    } catch (e) {
      this.destroy();
    }
  }

  vfunc_modify_paint_volume(pv) {
    return false;
  }
}

class MagicLampUnminimizeEffect extends AbstractCommonMagicLampEffect {
  static {
    GObject.registerClass(this);
  }

  _init(params = {}) {
    super._init(params);

    this.k = 1;
    this.j = 1;
    this.isMinimizeEffect = false;
  }

  destroy_actor(actor) {
    try {
      if (Main.wm && Main.wm._shellwm && Main.wm._shellwm.original_completed_unminimize) {
        Main.wm._shellwm.original_completed_unminimize(actor);
        return;
      }
    } catch (e) {}
    try {
      actor.show();
    } catch (e) {}
  }

  on_tick_elapsed(timer, msecs) {
    try {
      if (Main.overview && Main.overview.visible) {
        this.destroy();
        return;
      }

      this.progress = timer.get_progress();
      this.k = 1 - (this.progress > 1 - this.split ? (this.progress - (1 - this.split)) * (1 / 1 / (1 - (1 - this.split))) : 0);
      this.j = 1 - (this.progress <= 1 - this.split ? this.progress * (1 / 1 / (1 - this.split)) : 1);

      if (this.actor && this.actor.get_parent()) {
        this.actor.get_parent().queue_redraw();
      }
      this.invalidate();
    } catch (e) {
      this.destroy();
    }
  }

  vfunc_modify_paint_volume(pv) {
    return false;
  }
}
