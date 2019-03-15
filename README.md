# Pulse Plugin for VideoJS and Brightcove Player

## Introduction
The Pulse plugin in this repository can be used to create an integration between Pulse and your VideoJS or Brightcove Player. The plugin is built on top of the Pulse HTML5 ad player, which is part of [ HTML5 Pulse SDK](http://pulse-sdks.videoplaza.com/pulse-html5/latest/).

## Build
    npm install
    grunt


## Documentation Overview

##### Getting Started Tutorials

Depending on the player you wish to integrate with Pulse, go to one of the following pages to set up the basics for your player:
- [Getting Started with VideoJS](docs/videojs-getting-started.md)
- [Getting Started with Brightcove Player](docs/brightcove-getting-started.md)

##### Plugin Options and Session Settings

Information about each of the plugin options and session settings can be found on [Plugin Options and Session Settings](docs/options-settings.md)

##### Player Customizations

Information about further customizations you can make to the integration can be found on [Customizing Your VideoJS or Brightcove Player Integration](docs/player-customization.md)

## Videojs-contrib-ads compatibility

The Pulse plugin currently supports videojs-contrib-ads v6.x.

## Handling Autoplay 
This plugin uses videojs-contrib-ads (the tool for building Video.js Ad Plugins) and follows the [autoplay recommendation notes](https://github.com/videojs/videojs-contrib-ads/blob/master/docs/integrator/autoplay.md). Therefore, we strongly recommend that you do not use `autoplay` attribute on the video element and instead call the `play` function when the player is ready. 
```
player.ready(function() {
	//Set up the pulse plugin.
	player.pulse({....});
	//Create the autoplay behaviour. 
	player.play();
});
```

## Live content
The Pulse plugin supports prerolls in live content. Midrolls can also be triggered if the content stream outputs valid position data. 

**Note:** If not already set, the Pulse plugin will set the videojs-contrib-ads option `liveCuePoints` to 'false'. This will make sure that the content stays paused during prerolls, not playing muted underneath the ads.
See the videojs-contrib-ads [documentation](http://videojs.github.io/videojs-contrib-ads/integrator/options.html) for more information.

## API Docs
The full API docs are available in the [API Documentation](docs/videojs-pulse.md).

## Disclaimer

Provision of the plugin is limited to delivery and integration of the plugin, and does not include any approvals, licenses, consents, permissions (collectively, “Third Party Rights”), and/or related fees (“Third Party Fees”) that may be necessary for use of and integration with VideoJS or Brightcove Player. Company is responsible for obtaining and maintaining Third Party Rights and paying Third Party Fees, if any, for use of and integration with VideoJS or Brightcove Player.
