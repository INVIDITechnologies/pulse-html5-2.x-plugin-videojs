# Getting Started with Brightcove Player

>:warning: To integrate, you must have a Brightcove Player v6.x up and running on your site, as well as a Pulse account and a unique ID (pulseHost).

To get started with the integration and configure your Pulse hostname and additional page- or player-level metadata, there are two possible ways:

## <a name="bc-studio"></a>Through Brightcove Studio (Videocloud or Perform):

1. In Brightcove Studio, locate the player you want to configure and click on it.

2. In the next page, click the Plugins section.

3. In the Plugins section, click _Scripts_ tab and then _Add a Script_ and include the following source files in addition to your Brightcove embed code:
  - https://service.videoplaza.tv/proxy/pulse-sdk-html5/2.1/latest.min.js - The Pulse SDK.
  - https://service.videoplaza.tv/proxy/pulse-sdk-html5-skin/base.min.js - The Pulse SDK AdPlayer skin (if desired).
  - https://service.videoplaza.tv/proxy/pulse-sdk-html5-bridges/videojs/3/latest.min.js - The Pulse plugin for the Brightcove video player.
  - videojs-contrib-ads - The videojs ad manager plugin, available on [GitHub](https://github.com/videojs/videojs-contrib-ads), which you need to host yourself, or serve [from a CDN](https://cdnjs.com/libraries/videojs-contrib-ads).

  **https** may be substituted for **http** if required, or omitted (like `//url.to.file`) to automatically use the protocol of the current site.

  > The files can also be added to the page itself like for a standard videoJS integration. See [Getting Started with VideoJS](videojs-getting-started.md).

4. In the Plugins page, click _Name, Options (JSON)_, enter the name `pulse`, and then provide your Pulse hostname and optional page-level metadata in JSON format:
  ```
  {
    "debug": true,
    "contrib-ads-options": {
      "debug": true
    },
    "metadata": {
      "linearPlaybackPositions": [
        20,
        50
      ],
      "category": "skip-always",
      "tags": [
        "standard-linears",
        "pause"
      ]
    },
    "pulseHost": "http://pulse-demo.videoplaza.tv"
  }
  ```
  See [Plugin Options and Session Settings](options-settings.md) for all possible options you can set.

5. Click Save.

The plugin is automatically initiated when your player loads. No additional code is needed on the client side (Refer file https://github.com/INVIDITechnologies/pulse-html5-2.x-plugin-videojs/blob/master/demo/index_bc.html).

# Known Issues:
1. Starting a linear video ad (with audio) requires a separated (redundant) click for ads to play on macOS Safari 11. Workaround is provided in second way below i.e. "if you integrate through script directly on page level".

# Handling Autoplay:
This plugin uses videojs-contrib-ads (the tool for building Video.js Ad Plugins) and follows the [autoplay recommendation notes](https://github.com/videojs/videojs-contrib-ads/blob/master/docs/integrator/autoplay.md). Therefore, we strongly recommend that you do not use `autoplay` attribute on the video element and instead call the `play` function when the player is ready.
```
player.ready(function() {
	//Set up the pulse plugin.
	player.pulse({....});
	//Create the autoplay behaviour.
	player.play();
});
```
Refer file https://github.com/INVIDITechnologies/pulse-html5-2.x-plugin-videojs/blob/master/demo/autoplay_bc.html).

## Through script directly on page-level:

1. Include the same libraries in the same way as described above ([Through Brightcove Studio](#bc-studio)), or in the head of the page, in the same order as listed above.

2. Create a script on the page that listens for the player `ready` event and initialize the plugin there:
  ```
  function loadPlayers() {
      var readyPlayers = videojs.getPlayers();
      for(var id in readyPlayers) {
          var player = readyPlayers[id];
          player.ready(function() {
              player.pulse({
                  pulseHost: 'http://pulse-demo.videoplaza.tv',
                  metadata: {
                      tags: [ 'standard-linears' ],
                      category: 'skip-always'
                  }
              });
          });
      }
  }

  document.addEventListener('DOMContentLoaded', loadPlayers);
  ```
  See [Plugin Options and Session Settings](options-settings.md) for all possible options you can set.

  Files for reference:
  1. If you want to autoplay: https://github.com/INVIDITechnologies/pulse-html5-2.x-plugin-videojs/blob/master/demo/autoplay.html
  2. If you do not want to autoplay: https://github.com/INVIDITechnologies/pulse-html5-2.x-plugin-videojs/blob/master/demo/index.html

## Configure Metadata on Video Items in Brightcove Studio (Videocloud or Perform)

On your video items in Brightcove Studio, the following custom metadata is read by the Pulse plugin if available:

| Name        | Legacy name   | Sample input                      | Description                       |
|------------ |-------------  |---------------------------------- |---------------------------------- |
| pulse_tags    | vpTags        | sports,soccer,europe              | Matched against tag targeting rules set up in Pulse; comma separated.   |
| pulse_flags | vpFlags       | noprerolls*                     | Prevents certain ad types from being served; comma separated.|
| pulse_max_linear_break_duration | none        | 15                  | Maximum linear ad break duration in seconds.|
| pulse_category| vpCategory    | sports                          | Selects alternate ad insertion policies configured in Pulse.  |
| pulse_content_partner| vpContentPartner|                          |                                   |
| pulse_content_form| vpContentForm | shortForm _or_ longForm               | Selects ad insertion policies configured in Pulse for short/long form content.  |

:bulb: Additionally, cue points of type _ad_, with a name of either `vpspot` or `pulse_spot` are used to trigger midroll ads, and tags provided under the _Video Information_ section in Brightcove Studio are merged with values from `pulse_tags` metadata set on the individual video items.

_*Full list of available flags:_
- **noprerolls**: do not serve preroll ads
- **nomidrolls**: do not serve midroll ads
- **nopostrolls**: do not serve postroll ads
- **nocom**: do not serve any ads


## API Docs
The full API docs are available in the [API Documentation](videojs-pulse.md).
