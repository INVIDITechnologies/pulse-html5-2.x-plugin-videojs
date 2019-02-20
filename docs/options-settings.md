# Plugin Options and Session Settings

## <a name="plugin-options"></a>Plugin options

The plugin options object is a combination of Pulse global settings, Pulse metadata related to the selected video and any additional parameters to pass to the videojs-contrib-ads plugin.

* `pulseHost` : &lt;string\> Full hostname of the Pulse account to use.
* `deviceContainer` : &lt;string\> Pulse device container. It is recommended to set this parameter to `null`.
* `persistentId` : &lt;string\> Pulse persistent id; used for unique user tracking.
* `metadata` : &lt;object> An object containing the session settings as described under [Session Settings](#session-settings). When integrating with the Brightcove Player, these settings are combined with the metadata set for each video item in Brightcove Studio.
* `adPlayerOptions` : &lt;object> An object containing any settings you may want to apply when creating the Ad Player. For possible settings, see the relevant section of the Pulse SDK [API documentation](http://pulse-sdks.videoplaza.com/pulse-html5/latest/OO.Pulse.html#.AdPlayerSettings__anchor).
* `contrib-ads-options` : &lt;object> An object containing the parameters to pass to the videojs-contrib-ads plugin, see [videojs-contrib-ads](https://github.com/videojs/videojs-contrib-ads) for more information.
* `hidePoster` : &lt;Boolean> If true, the video poster and title will be hidden until the first time the content plays, after prerolls. Useful if you have implemented your own autoplay solution.
* `debug` : &lt;Boolean> If true, the plugin and Pulse SDK will output debug info to the console

## <a name="session-settings"></a>Session settings

The session settings object is a combination of contentMetadata and requestSettings, used by the Pulse SDK. You can see the description of the content metadata and request settings [here](http://pulse-sdks.videoplaza.com/pulse-html5/latest/OO.Pulse.html).

* `category` : &lt;string\> Content category is used by Pulse to target ads and determine the ad insertion policy. The content category is represented by either its unique id or one of its aliases set in Pulse.
* `contentForm` : &lt;[OO.Pulse.ContentForm](http://pulse-sdks.videoplaza.com/pulse-html5/latest/OO.Pulse.html#.ContentForm)> Content form is used to determine the ad insertion policy.
* `id` : &lt;string>  Pulse content id. Id is used to identify the content to third parties.
* `contentPartner`: &lt;string> Pulse content partner. Content partners can be used by Pulse to target ads. The content partner is represented by either its unique id or one of its aliases set in Pulse.
* `duration`: &lt;number>  The duration of the content selected by the viewer. This value cannot be negative.
* `flags` : &lt;string[]> Pulse flags. Because flags override Pulse's ad insertion policy, they should be used with caution. For more information talk to your contact at INVIDI. Supported flags: nocom, noprerolls, nomidrolls, nopostrolls, nooverlays, noskins.
* `tags` : &lt;string[]> Pulse content tags, used to target specific ads.
* `customParameters`: &lt;object>  The custom parameters to add to the session request. Parameters with names containing invalid characters are omitted. These custom parameters are added to the ad server request URL in the style of "cp.[parameter_name]=[parameter_value]".
* `height` : &lt;number>  Height in pixels of the video area where ads should be shown.
* `maxBitRate` : &lt;number>  The maximum bitrate of the media files in the ad response.
* `maxLinearBreakDuration` : &lt;number>  The maximum length (in seconds) of linear ad breaks.
* `linearPlaybackPositions` : &lt;number[]> An array of numbers which defines at what points in time linear ads should be shown.
* `nonlinearPlaybackPositions`: &lt;number[]>  An array of numbers which defines at what points in time non-linear ads should be shown.
* `insertionPointFilter` : &lt;[OO.Pulse.InsertionPointType](http://pulse-sdks.videoplaza.com/pulse-html5/latest/OO.Pulse.html#.InsertionPointType)>  If not set, the request is for every kind of insertion point. If set, only the types provided are requested.
* `width` : &lt;number>  Width in pixels of the video area where ads should be shown.
* `referrerUrl` : &lt;string>  Overrides the HTTP header's referrer property.
* `linearSlotSize` : &lt;number>  Overrides the number of linear ads per slot. Using this affects the predictability of the Pulse forecast functionality. Use with caution.
* `enforceCacheBusting` : &lt;Boolean> If set to false, a randomized cache busting parameter is not added to VAST 2.0 tracking URLs which are missing the [CACHEBUSTING] macro. If not set, or set to true (default), the parameter is added.
* `useVASTSkipOffset` : &lt;Boolean> If set to true, skip offset information provided in third party VAST tickets determines the skip behaviour of third party ads. If not set, or set to false (default), the insertion policy configured in Pulse determines the skip behaviour instead.
* `seekMode` : &lt;[OO.Pulse.SeekMode](http://pulse-sdks.videoplaza.com/pulse-html5/latest/OO.Pulse.html#.SeekMode)> Determines how the ad session behaves when the viewer seeks past one or more ad breaks. If not provided, it defaults to `IGNORE.
* `preferredMediaFormat` : &lt;[OO.Pulse.PreferredMediaFormat](http://pulse-sdks.videoplaza.com/pulse-html5/latest/OO.Pulse.html#.PreferredMediaFormat)> If set, the media file with the preferred media format is ranked at the top of the list of the ad's eligible media files.
* `liveParameters` : &lt;number[]> A list of live parameters indicating which behaviours should be disabled for a live event. If an empty list is set, the behaviour defaults to `DISABLE_ALL`. Notice that if all parameters are sent at once, then no action would be taken, i.e DISABLE_ALL would disable everything and other parameters would re-enable them.
* `enableGdpr` : &lt;Boolean> Set to true if the ad request is subject to GDPR regulations. See [API Documentation](https://github.com/InteractiveAdvertisingBureau/GDPR-Transparency-and-Consent-Framework/blob/master/v1.1 Implementation Guidelines.md) for imore information.
* `gdprConsentString` : &lt;string[]> Pass in the user's URL safe and base64 encoded consent string related to GDPR regulations, which may be obtained through the Consent Management Provider (CMP) JS API. This string is built up according to the data structure developed by the GDPR Consent Working Group under the auspices of IAB Europe. The data structure specification can be found at [Consent string and vendor list formats v1.1 Final](https://github.com/InteractiveAdvertisingBureau/GDPR-Transparency-and-Consent-Framework/blob/master/Consent string and vendor list formats v1.1 Final.md). For more information on the API, refer to [CMP JS API v1.1 Final](https://github.com/InteractiveAdvertisingBureau/GDPR-Transparency-and-Consent-Framework/blob/master/CMP JS API v1.1 Final.md) .
* `gdprPersonalDataIncluded` : &lt;Boolean> Set to true if you are passing in personal information when creating the ad request to Pulse. The only location where it is possible to pass in personal information is in the `customParameters` of [ContentMetadata](http://pulse-sdks.videoplaza.com/pulse-html5/latest/OO.Pulse.html#.ContentMetadata) .
