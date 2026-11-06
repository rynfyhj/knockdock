# KnockDock

A GNOME Shell desktop management extension combining an animated dock with top bar customization and integrated magic lamp window animations. Based on Dash2Dock Animated and the Compiz magic lamp effect.


![Contributors](https://img.shields.io/github/contributors/icedman/dash2dock-lite?color=dark-green) ![Forks](https://img.shields.io/github/forks/icedman/dash2dock-lite?style=social) ![Stargazers](https://img.shields.io/github/stars/icedman/dash2dock-lite?style=social) ![Issues](https://img.shields.io/github/issues/icedman/dash2dock-lite) ![License](https://img.shields.io/github/license/icedman/dash2dock-lite)

![Screen Shot](https://raw.githubusercontent.com/icedman/dash2dock-lite/main/screenshots/Screenshot%20from%202024-03-19%2015-31-27.png)

### Notice

* Supports GNOME Shell 45, 46, 47, 48, 49, 50 and 51
* Works on Wayland and X11; Wayland requires logging out and back in after installing or updating

### Features

* Multi-monitor support (new!)
* Dash docked at the desktop
* Animated dock icons
* Resize icons
* Autohide/intellihide
* Dock positions: bottom, top, left, right
* Scroll wheel to cycle windows
* Click to maximize/minimize windows
* Style top panel
* Panel mode
* Show/Hide Apps icon
* Analog clock
* Dynamic calendar
* Dynamic trash icon
* Mounted devices
* Downloads icon with fan animation (new!)
* Icon color effects (Tint, Monochrome)
* Custom icons

### Third-Party Compatibility

* [Compiz Magic Lamp Animation](https://github.com/PR3SIDENT/gnome-shell-extension-compiz-alike-magic-lamp-effect)
* [Blur my Shell](https://github.com/aunetx/blur-my-shell)

### Prerequisites

* GNOME Shell 45 or newer
* `gjs` and `glib-compile-schemas` (provided by GNOME)

### Installation

#### From the release ZIP

Download `knockdock@casper.local.shell-extension.zip` and install it with the
GNOME Extensions app (**Install from file**), or from a terminal:

```bash
gnome-extensions install --force knockdock@casper.local.shell-extension.zip
gnome-extensions enable knockdock@casper.local
```

Log out and back in on Wayland, then open the extension settings.

#### Build from source

```bash
./build-extension.sh
gnome-extensions install --force dist/knockdock@casper.local.shell-extension.zip
```

## Theme Support

Use **Style** > **Theme** to import or export a theme.

Export saves every KnockDock setting to `/tmp/$USER-theme.json`, including
value types, so the same file can be imported again reliably. Exported files
can also be copied into `~/.config/knockdock/themes` or
`{extension_path}/themes` to appear in the theme menu.

## Custom Icons

Create a folder under `~/.config/knockdock/icons` and place your SVG icons there. Then create a file under `~/.config/knockdock/icons.json` using the following format:

```json
{
  "icons": {
     "view-app-grid-symbolic": "icons/show-apps-icon.svg",
     "user-trash": "icons/my-own-trash.svg",
     "user-trash-full": "icons/my-own-trash-full.svg"
  }
}
```

You may also use **icon names** from your favorite icon theme using the following format:

```json
{
  "icons": {
     "view-app-grid-symbolic": "show-apps-icon",
     "user-trash": "trash",
     "user-trash-full": "trash-full"
  }
}
```

The icons `show-apps-icon`, `trash`, and `trash-full` must be available in your icon theme folder.

Alternatively, you may override icons via app ID:

```json
{
   "apps": {
      "spotify_spotify": "icons/spotify.svg"
   }
}
```

Check the logs to see the icon names currently being used by Dash2Dock Animated. Search for log text such as:

```sh
Icon created "user-trash"
```

## Custom Config

Create a file `config.json` under the folder `~/.config/knockdock/`

```json
{
  "file-explorer": "nemo",
  "icon-size": "24"
}
```

* Disable then enable the extension to load the configuration
* `file-explorer` overrides the default "nautilus"
* `icon-size` overrides the icon scale from the preferences panel

## Custom CSS

Create a file `style.css` under the folder `~/.config/knockdock/`

For now, you will have to use Looking Glass (GNOME's built-in debugger) to inspect class names and styles.

## Blurred Background

The blurred background feature requires the **Blur my Shell** extension (`blur-my-shell@aunetx`).

## GNOME 42, 43, 44 Support

To build and install Dash2Dock Animated for older versions (prior to GNOME 45), run:

```bash
make g44
```

## Bug Reporting

When reporting bugs, please include the following details:

* Linux Flavor/Distribution and version
* GNOME version (e.g. 45.xx)
* Dash2Dock Animated release number

Check for any exceptions in the logs by running the following in the terminal:

```bash
journalctl /usr/bin/gnome-shell -f -o cat
```

To check for incompatibilities with other extensions, try running Dash2Dock Animated with all other extensions disabled.

To check for lag or inefficiency, run the following in the terminal and observe `gnome-shell` CPU usage:

```bash
top -d 0.5
```

On a Dell XPS 13 (i5-6200U), CPU usage is about 50% with icon quality set to High, frame rate set to High, and shadows enabled.

Please be specific about the errors encountered, and attach screenshots if possible.

## Testing Rig

* Fedora 45 (GNOME 51)
* Fedora 43 (GNOME 49)
* Arch Linux (GNOME 49)
* Fedora 37 Live (GNOME 42)
* Ubuntu 23 (GNOME 45)

## License

Distributed under the GPL 3.0 License. See [LICENSE](LICENSE) for more information.