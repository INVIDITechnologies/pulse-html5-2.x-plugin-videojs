(function(vjs) {
    'use strict';

    function log() {
        let args = Array.prototype.slice.call(arguments);
        if (OO.Pulse) {
            if (OO.Pulse.Utils.logTagged) {
                args.unshift([{ tag: 'vjs', color: '#407A5C' }]);
                OO.Pulse.Utils.logTagged.apply(null, args);
            } else {
                OO.Pulse.Utils.log.apply(null, args);
            }
        } else {
            args.unshift('OO.Pulse: ');
            console.log.apply(window.console, args);
        }
    }

    const pulsePlugin = function(options, readyForPrerollCallback, adClickedCallback, adMuteStateChangedCallback) {
        ((player) => {
            let session = null;
            let pageMetadata = options.metadata || {};
            let vjsControls;
            let adPlayer;
            let adContainerDiv;
            let sharedElement = null;
            let resizeHandle;
            let sessionStarted = false;
            let firstPlay = true;
            let pauseAdTimeout = null;
            let isFree = false;
            let contentUpdated = false;
            let disabledCues = [];
            let adPlayerOptions = options.adPlayerOptions || {};
            let customBehaviours = {};
            let useShared = false;
            let playlistItemChange = false;
            let isContentStartedReported = true;
            //Helper flags to ensure that mute state change only get reported when the ads started playing.
            let duringAdPlayback = false;
            let previousAdVolume = 0;
            
            const playerIsSetToAutoplay = !!player.autoplay();
            // player.autoplay() may return:
            // false (boolean)  - Player should not autoplay.
            // true (boolean)   - Call play() on every loadstart
            // 'play' (string)  - Try to autoplay the video.
            // 'muted' (string) - Call muted() then play() on every loadstart
            // 'any' (string)   - Call play() on every loadstart. If that fails call muted() then play().

            if (!OO || !OO.Pulse) {
                throw new Error('The Pulse SDK is not included in the page. Be sure to load it before the Pulse plugin for videojs.');
            }

            // Make sure that 'liveCuePoints' is set to false by default.
            // This will make sure preroll ads play with sound on live content.
            const contribAdsOptions = options['contrib-ads-options'];
            if( !contribAdsOptions.hasOwnProperty('liveCuePoints') ) {
                contribAdsOptions['liveCuePoints'] = false;
            }
            
            //Init videojs-contrib-ads plugin
            player.ads(contribAdsOptions);
            
            //Toggle debug mode if option is available.
            OO.Pulse.debug = options.debug || OO.Pulse.debug;
            //Read query string parameters from page's URL.
            const queryParams = getQueryStringParams();
            // Automatically hide poster if autoplay is enabled
            // (autoplay will not work on the following mobile devices)
            if (!vjs.browser.IS_IOS && !vjs.browser.IS_ANDROID) {
                if (playerIsSetToAutoplay || (queryParams.hasOwnProperty('autoplay') && queryParams.autoplay === undefined) || queryParams.autoplay === '1' || queryParams.autoplay === 'true') {
                    player.addClass('vjs-pulse-hideposter');
                }
            } else if (options.hidePoster) {
                player.addClass('vjs-pulse-hideposter');
            }

            //Set the Pulse global settings
            OO.Pulse.setPulseHost(options.pulseHost, options.deviceContainer, options.persistentId);
            //Create the ad player
            createAdContainer();
            
            log("player.autoplay is set to '" + player.autoplay() + "' [" + playerIsSetToAutoplay + "]");
            
            const forceSharedElement = queryParams.hasOwnProperty('pulse_force_shared');

            if (forceSharedElement) {
                useShared = true;
                log('Using shared element because pulse_force_shared parameter is present');
                
            } else {
            
                let autoplayMode = 'normal';
                
                if (typeof OO.Pulse.getAutoplayMode === 'function') {
                    autoplayMode = OO.Pulse.getAutoplayMode();
                    log("getAutoplayMode says: " + autoplayMode);
                } else if (!isAutoplaySupported()) {
                    autoplayMode = 'shared';
                }

                if(autoplayMode === 'shared') {
                    useShared = true;
                    log('Using shared element because autoplay support was not detected');
                } else if(autoplayMode === 'muted' && playerIsSetToAutoplay === true) {
                    adPlayerOptions.setAutoplayAttributes = true;
                    log('Using setAutoplayAttributes because autoplay support was not detected');
                } else if(autoplayMode !== 'normal' && playerIsSetToAutoplay === true) {
                    log('Received unknown autoplay mode: ', autoplayMode, '; it will be ignored');
                } else if(playerIsSetToAutoplay === false) {
                    log('Autoplay set to \'false\' by the video player/query parameters, will not try to autoplay ads');
                    adPlayerOptions.setAutoplayAttributes = false;
                }
            }

            if (useShared) {
                sharedElement = getSharedElement();
                // Set the video element source with MIME-type included to avoid issues with other media sources
                customBehaviours.setVideoSource = ((mediaFile, element) => {
                    player.src({
                        src: mediaFile.url,
                        type: mediaFile.mimeType
                    });
                });
            }

            // Setup adPlayer configuration based on plugin context.
            adPlayerOptions.adContainerElement = adContainerDiv;
            adPlayerOptions.sharedVideoElement = sharedElement;
            adPlayerOptions.customBehaviours = customBehaviours;

            //Initiate ad player.
            adPlayer = OO.Pulse.createAdPlayer(adPlayerOptions);

            //Register to player events as soon as the plugin gets initialized.

            registerPlayerEventListeners();

            /**
             * ***********************************************************************************************
             * Subscribe to ad player events that we will use to report back ad playback states to contrib-ads.
             * ***********************************************************************************************
            **/


            adPlayer.addEventListener(OO.Pulse.AdPlayer.Events.PAUSE_AD_SHOWN, (event, eventData) => {
                // Make sure that the videojs control are visible for pause ads
                vjsControls.el().style['z-index'] = 10000;
            });

            adPlayer.addEventListener(OO.Pulse.AdPlayer.Events.AD_VOLUME_CHANGED, (event, eventData) => {
                if (duringAdPlayback) {
                   if(adMuteStateChangedCallback) {
                        previousAdVolume = eventData.volume;
                        adMuteStateChangedCallback(eventData);
                   } else {
                        if (!sharedElement) {
                            if (eventData.volume === 0) {
                                player.muted(true);
                            } else {
                                player.muted(false);
                            }
                        }
                   }
                }
            });

            adPlayer.addEventListener(OO.Pulse.AdPlayer.Events.AD_CLICKED, (event, eventData) => {
                if (adClickedCallback) {
                    adClickedCallback(eventData);
                } else if (eventData.url) {
                    // Default clickthrough behaviour
                    adPlayer.pause();
                    openAndTrackClickThrough(eventData.url);
                }
            });

            adPlayer.addEventListener(OO.Pulse.AdPlayer.Events.AD_BREAK_STARTED, () => {
                player.trigger('ads-pod-started');
                // Hide the VJS loading spinner
            });

            adPlayer.addEventListener(OO.Pulse.AdPlayer.Events.AD_BREAK_FINISHED, () => {
                player.trigger('ads-pod-ended');
                duringAdPlayback = false;
            });

            adPlayer.addEventListener(OO.Pulse.AdPlayer.Events.LINEAR_AD_STARTED, () => {
                previousAdVolume = adPlayer._muted? 0 : adPlayer._volume;
                player.trigger('ads-ad-started');

                // Disable captions
                hideTextTracks();
            });

            adPlayer.addEventListener(OO.Pulse.AdPlayer.Events.LINEAR_AD_PLAYING, ()=> {
                duringAdPlayback = true;
            });

            adPlayer.addEventListener(OO.Pulse.AdPlayer.Events.LINEAR_AD_FINISHED, () => {
                player.trigger('ads-ad-ended');
                // Disable captions
                hideTextTracks();
                duringAdPlayback = false;
            });

            /**
             * *****************************************************************************************************
             * ENDOF Subscribe to ad player events that we will use to report back ad playback states to contrib-ads.
             * ******************************************************************************************************
            **/

            function showTextTracks() {
                if (!sharedElement) {
                    return;
                }

                let enabledCues = 0;
                for (let i = 0; i < disabledCues.length; ++i) {
                    disabledCues[i].mode = 'showing';
                    ++enabledCues;
                }

                disabledCues = [];
                if (enabledCues > 0) {
                    log(enabledCues + ' caption tracks enabled after ad playback');
                }
            }

            function hideTextTracks() {
                if (!sharedElement) {
                    return;
                }

                showTextTracks();

                for (let i = 0; i < player.textTracks().length; ++i) {
                    const track = sharedElement.textTracks[i];
                    if (track && 'mode' in track && track.mode === 'showing') {
                        track.mode = 'disabled';
                        disabledCues.push(track);
                    }
                }

                if (disabledCues.length > 0) {
                    log(disabledCues.length + ' caption tracks disabled during ad playback');
                }
            }

            // Initialize ad session.

            let initialiseAdSession = function() {
                doInitSession(player.mediainfo, pageMetadata);
            };


            player.on('play', () => {

                if (pauseAdTimeout) {
                    clearTimeout(pauseAdTimeout);
                    pauseAdTimeout = null;
                }

                if (firstPlay) {
                    //Pass along the player volume to ad player.
                    adPlayer.setVolume(player.muted() ? 0 : player.volume());
                    firstPlay = false;
                    initialiseAdSession();

                } else if (!useShared) {
                    reportContentStarted();
                }

                if (!isFree) {
                    delete vjsControls.el().style['z-index'];
                }



            });

            player.on('pause', function() {
                if (!isFree &&
                    !player.seeking() &&
                    !player.ads.isInAdMode() &&
                    sessionIsValid()
                ) {
                    pauseAdTimeout = setTimeout(function() {
                        adPlayer.contentPaused();
                        isContentStartedReported = false;
                    }, 100);
                }
            });


            //=====================================================================
            //                      PUBLIC API
            //=====================================================================

            let PulseAPI = function(adPlayer) {
                /**
                 * Pulse ad player
                 */
                this.adPlayer = adPlayer;

                /**
                 * Pulse plugin version
                 */
                this.version = "@VERSION";
            }

            /**
             * Initialize a new session.
             * @param sessionSettings
             * @returns {*}
             */
            PulseAPI.prototype.initSession = function(sessionSettings) {
                //To-do
                resetPlugin();
                pageMetadata = sessionSettings;
                return session;
            };

            /**
             * Provide the created session.
             * @returns the created session.
             */
            PulseAPI.prototype.getCurrentSession = function() {
                return session;
            }


            /**
             * True if pulse SDK is using shared Element to show ads on mobile.
             * @returns {boolean}
             */
            PulseAPI.prototype.isUsingSharedElement = function() {
                return useShared;
            }

            /**
             * Start a pulse session
             * @param userSession
             */
            PulseAPI.prototype.startSession = function(userSession) {
                adPlayer.startSession(userSession, adPlayerListener);
                sessionStarted = true;
            };

            /**
             * Set the metadata used for ad requests
             * @param sessionSettings
             */
            PulseAPI.prototype.setMetadata = function(sessionSettings) {
                pageMetadata = sessionSettings;
            }

            /**
             * True if in an ad break
             * @returns {boolean}
             */
            PulseAPI.prototype.isInLinearAdMode = function() {
                return isInLinearAdMode;
            };

            /**
             * Add an event listener to the Pulse ad player to access event data or to add
             * your own logic to the event handling. All ad player events are listed
             * [here](http://pulse-sdks.videoplaza.com/pulse-html5/latest/OO.Pulse.AdPlayer.Events.html).
             * @param event event to listen to
             * @param callback callback function
             */
            PulseAPI.prototype.addEventListener = function(event, callback) {
                adPlayer.addEventListener(event, callback);
            };

            /**
             * Remove an event listener
             * @param event ad player event
             * @param callback callback to remove
             */
            PulseAPI.prototype.removeEventListener = function(event, callback) {
                adPlayer.removeEventListener(event, callback);
            };

            /**
             * Stop the ad session. No more ads will be displayed in the video.
             */
            PulseAPI.prototype.stopSession = function() {
                if (sessionIsValid()) {
                    try {
                        adPlayer.stopSession();
                    } catch (e) {

                    }
                    session = null;
                }
            };

            /**
             * Destroy the plugin and the ad player. Call this method in case the page is also
             * used to display other content where you no longer need the Brightcove player and the
             * player is removed from the page.
             */
            PulseAPI.prototype.destroy = function() {
                this.stopSession();
                resetStates();
            };

            // Make sure each player has its own public API instance
            player.pulse = new PulseAPI(adPlayer);

            function sessionIsValid() {
                return !!session && !!session._currentSession;
            }

            //Merge the brightcove studio metadata with the page metadata
            function mergeMetadata(mediaMetadata, pageMetadata) {
                let finalMetadata = {};

                // Brightcove CMS metadata
                if (mediaMetadata) {
                    finalMetadata.tags = mediaMetadata.tags;

                    // cue points
                    if (mediaMetadata.cue_points && mediaMetadata.cue_points.length > 0) {
                        let mediaCuePoints = [];
                        let cuePoint;
                        for (let i = 0; i < mediaMetadata.cue_points.length; ++i) {
                            cuePoint = mediaMetadata.cue_points[i];

                            if (cuePoint.type === 'AD' && (cuePoint.name === 'vpspot' || cuePoint.name === 'pulse_ad')) {
                                mediaCuePoints.push(cuePoint.time);
                            }
                        }

                        if (mediaCuePoints.length > 0) {
                            finalMetadata.linearPlaybackPositions = mediaCuePoints;
                        }
                    }
                    
                    if (mediaMetadata.custom_fields) {

                        const pulseTags = mediaMetadata.custom_fields.pulse_tags || mediaMetadata.custom_fields.vpTags;
                        if (pulseTags) {
                            finalMetadata.tags = pulseTags.split(',');
                        }

                        const pulseFlags = mediaMetadata.custom_fields.pulse_flags || mediaMetadata.custom_fields.vpFlags;
                        if (pulseFlags) {
                            finalMetadata.flags = pulseFlags.split(',');
                        }

                        const insertionPointFilter = mediaMetadata.custom_fields.pulse_insertion_point_filter;
                        if (insertionPointFilter) {
                            finalMetadata.insertionPointFilter = insertionPointFilter.split(',');
                        }

                        const pulseHost = mediaMetadata.custom_fields.pulse_host || mediaMetadata.custom_fields.vpHost;
                        if (pulseHost) {
                            finalMetadata.pulseHost = pulseHost;
                        }

                        const seekMode = mediaMetadata.custom_fields.pulse_seek_mode;
                        if (seekMode) {
                            finalMetadata.seekMode = seekMode;
                        }

                        const preferredMediaFormat = mediaMetadata.custom_fields.pulse_preferred_media_format;
                        if (preferredMediaFormat) {
                            finalMetadata.preferredMediaFormat = preferredMediaFormat;
                        }

                        const pulseCategory = mediaMetadata.custom_fields.pulse_category || mediaMetadata.custom_fields.vpCategory;
                        if (pulseCategory) {
                            finalMetadata.category = pulseCategory;
                        }

                        const pulseContentPartner = mediaMetadata.custom_fields.pulse_content_partner || mediaMetadata.custom_fields.vpContentPartner;
                        if (pulseContentPartner) {
                            finalMetadata.contentPartner = pulseContentPartner;
                        }

                        const pulseContentForm = mediaMetadata.custom_fields.pulse_content_form || mediaMetadata.custom_fields.vpContentForm;
                        if (pulseContentForm) {
                            finalMetadata.contentForm = pulseContentForm;
                        }

                        const pulseMaxLinearBreakDuration = parseInt(mediaMetadata.custom_fields.pulse_max_linear_break_duration);
                        if (pulseMaxLinearBreakDuration && !isNaN(pulseMaxLinearBreakDuration)) {
                            finalMetadata.maxLinearBreakDuration = pulseMaxLinearBreakDuration;
                        }

                    }
                    if (mediaMetadata.id) {
                        finalMetadata.id = mediaMetadata.id;
                    }

                    // Legacy: BC map metadata
                    if (mediaMetadata.vpBCMapTags) {
                        finalMetadata.tags = mediaMetadata[mediaMetadata.vpBCMapTags].split(',');
                    }

                    if (mediaMetadata.vpBCMapFlags) {
                        finalMetadata.flags = mediaMetadata[mediaMetadata.vpBCMapFlags].split(',');
                    }

                    if (mediaMetadata.vpBCMapCategory) {
                        finalMetadata.category = mediaMetadata[mediaMetadata.vpBCMapCategory];
                    }

                    if (mediaMetadata.vpBCMapContentPartner) {
                        finalMetadata.contentPartner = mediaMetadata[mediaMetadata.vpBCMapContentPartner];
                    }
                }

                // Player plugin config or page-level metadata
                if (pageMetadata) {
                    for (let key in pageMetadata) {
                        if (key === 'tags') {
                            if (!finalMetadata.tags) {
                                finalMetadata.tags = pageMetadata.tags;
                            } else {
                                finalMetadata.tags = finalMetadata.tags.concat(pageMetadata.tags);
                            }
                        } else {
                            finalMetadata[key] = pageMetadata[key];
                        }
                    }
                }

                return finalMetadata;
            }

            function resetPlugin() {
                //If there was an existing session, stop it
                resetStates();
                //Register the relevant event listeners
                registerPlayerEventListeners();
            }

            function doInitSession(mediaMetadata, pageMetadata) {
                sessionStarted = false;
                let finalMetadata = mergeMetadata(mediaMetadata, pageMetadata);
                initSession.call(this, getContentMetadataFromSessionSettings(finalMetadata),
                    getRequestSettingsFromSessionSettings(finalMetadata));
                //After ads are fetched, we inform contrib-ads that we're ready to start playing ads.
                player.trigger('adsready');
            }

            //Volume change listener
            function onVolumeChange() {
                let volume = player.volume();
                adPlayer.setVolume(volume);
            }

            //fullscreen change listener
            function onSizeChanged() {
                adPlayer.resize(
                    OO.Pulse.AdPlayer.Settings.SCALING.AUTO,
                    OO.Pulse.AdPlayer.Settings.SCALING.AUTO,
                    player.isFullscreen()
                );
            }

            // Get the HTML5 video element
            function getSharedElement() {
                return document.getElementById(player.id() + '_html5_api');
            }

            function readyForPreroll() {

                isFree = !!player.mediainfo && player.mediainfo.economics === 'FREE';
                if (isFree) {
                    log('Video is marked as not ad-supported; ad session will not be requested');
                    player.trigger('nopreroll');
                    return;
                }

                if (sessionStarted) {
                    player.trigger('nopreroll');
                    return;
                }

                player.ads.startLinearAdMode();

                if (readyForPrerollCallback) {
                    readyForPrerollCallback();
                } else {
                    //Start the session.
                    player.pulse.startSession(session);
                }

            }

            function contentChanged() {
                initialiseAdSession();
            }

            //Time update callback for videojs
            function timeUpdate() {
                if (sessionIsValid() && !player.seeking() && !player.paused()) {
                    adPlayer.contentPositionChanged(player.currentTime());
                }
            }

            //Content playback listener for videojs
            function contentPlayback() {
                if (sessionIsValid()) {
                    reportContentStarted();
                }
            }

            function readyForPostroll() {
                if (pauseAdTimeout) {
                    clearTimeout(pauseAdTimeout);
                    pauseAdTimeout = null;
                }

                if (isFree) {
                    return;
                }

                adPlayer.contentFinished();
            }

            //Register the relevant event listeners
            function registerPlayerEventListeners() {
                player.on('readyforpreroll', readyForPreroll);
                player.on('readyforpostroll', readyForPostroll);
                player.on('contentchanged', contentChanged);
                player.on('timeupdate', timeUpdate);
                player.on('playing', contentPlayback);
                player.on('fullscreenchange', onSizeChanged);
                player.on('volumechange', onVolumeChange);

                //Start checking for the player size
                resizeHandle = setInterval(onSizeChanged, 1000);
            }

            function unregisterPlayerEventListeners() {
                player.off('readyforpreroll', readyForPreroll);
                player.off('readyforpostroll', readyForPostroll);
                player.off('contentchanged', contentChanged);
                player.off('timeupdate', timeUpdate);
                player.off('playing', contentPlayback);
                player.off('fullscreenchange', onSizeChanged);
                player.off('volumechange', onVolumeChange);

                clearInterval(resizeHandle);
            }

            function reportContentStarted() {
                if (!isContentStartedReported && sessionIsValid()) {
                    adPlayer.contentStarted();
                    isContentStartedReported = true;
                }
            }

            function getQueryStringParams() {
                let params = {};
                let ps = [];

                try {
                    if (window) {
                        if (window.top && window.top.location) {
                            ps = window.top.location.search.split("&")
                        } else {
                            ps = window.location.search.split("&");
                        }
                    }
                } catch (e) {
                    return ps;
                }


                if (ps && ps[0]) {
                    ps[0] = ps[0].slice(1);
                }

                for (let i = 0; i < ps.length; i++) {
                    if (ps[i]) {
                        let p = ps[i].split(/=/);
                        params[p[0]] = p[1];
                    }
                }
                return params;
            }

            //Reset all the states to their original values
            function resetStates() {
                unregisterPlayerEventListeners();
                sessionStarted = false;
                isContentStartedReported = true;
                session = null;
            }

            /**
             * Default clickThrough handler
             * @param url
             */
            function openAndTrackClickThrough(url) {
                window.open(url);
                if (sessionIsValid()) {
                    adPlayer.adClickThroughOpened();
                }
            }

            //Detects if a mobile device is used. If that's the case the plugin will used a shared video
            //element to show ads
            function isMobile() {
                let check = false;
                (function(a) { if (/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino|android|ipad|playbook|silk/i.test(a) || /1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(a.substr(0, 4))) check = true })(navigator.userAgent || navigator.vendor || window.opera);
                return check;
            }

            function isAutoplaySupported() {
                // New behaviour
                if (typeof OO.Pulse.canAutoplay === 'function') {
                    return OO.Pulse.canAutoplay();
                }

                // Old behaviour
                return !isMobile();
            }

            /**
             * Remove null/undefined properties from an object
             * @param obj
             */
            function cleanObject(obj) {
                for (let prop in obj) {
                    if (obj[prop] === null || obj[prop] === undefined) {
                        delete obj[prop];
                    }
                }
            }

            /**
             * Get the content metadata object from the session settings
             * @param sessionSettings
             * @returns {{category: *, contentForm: (*|string), id: *, contentPartner: *, duration: *, flags: *, tags: *, customParameters: *}}
             */
            function getContentMetadataFromSessionSettings(sessionSettings) {
                let contentMetadata = JSON.parse(JSON.stringify(sessionSettings));;

                //Remove the empty elements for the SDK
                cleanObject(contentMetadata);

                return contentMetadata;
            }

            /**
             * Extract the request settings object needed by the Pulse SDK
             * @param sessionSettings
             * @returns {{height: *, width: *, maxBitRate: *, linearPlaybackPositions: *, nonlinearPlaybackPositions: *, insertionPointFilter: *, referrerUrl: *, linearSlotSize: *}}
             */
            function getRequestSettingsFromSessionSettings(sessionSettings) {
                
                const requestSettings = JSON.parse(JSON.stringify(sessionSettings));
                
                requestSettings.width = requestSettings.width || player.currentWidth();
                requestSettings.height = requestSettings.height || player.currentHeight();

                // Remove the empty fields for the SDK
                cleanObject(requestSettings);

                return requestSettings;
            }

            /**
             * Init the Pulse session
             * @param contentMetadata content Metadata
             * @param requestSettings request Settings
             */
            function initSession(contentMetadata, requestSettings) {
                session = OO.Pulse.createSession(contentMetadata, requestSettings);
            }

            /**
             * Create the ad container div for the Pulse ad player
             */
            function createAdContainer() {
                // The adContainerDiv is the DOM of the element that will house
                // the ads and ad controls.
                vjsControls = player.getChild('controlBar');
                adContainerDiv =
                    vjsControls.el().parentNode.appendChild(
                        document.createElement('div'));
            }

            /**
             * Make sure the ad player gets the click events
             */
            function setPointerEventsForClick() {
                if (sharedElement) {
                    document.getElementById(player.id()).style.pointerEvents = "none";
                    sharedElement.style.pointerEvents = "all";
                }
            }


            /**
             * Restores the pointer events to their defaults states
             */
            function removePointerEventsForClick() {
                if (sharedElement) {
                    document.getElementById(player.id()).style.pointerEvents = "";
                    sharedElement.style.pointerEvents = "";
                }
            }


            //Ad player listener interface for the ad player
            let adPlayerListener = {
                startContentPlayback: function() {
                    if (player.ads.isInAdMode()) {
                        player.ads.endLinearAdMode();
                    }
                    showTextTracks();
                    if (sharedElement) {
                        sharedElement.style.display = 'block'; // Make sure the shared element is visible
                    }

                    isContentStartedReported = false;
                    vjsControls.show();
                    removePointerEventsForClick();

                },
                pauseContentPlayback: function() {
                    //Ensure that user experience is not disrupted when there is a transition from content to ad playback.
                    adPlayer.setVolume(player.muted() ? 0 : player.volume());

                    if (!player.ads.isInAdMode() || player.ads.isWaitingForAdBreak()) {
                        player.ads.startLinearAdMode();
                    }
                    if (!sharedElement) {
                        player.pause();
                    }

                    vjsControls.hide();
                    log('Paused; starting linear ad mode with state ' + player.ads.state);

                    setPointerEventsForClick();
                },
                illegalOperationOccurred: function(msg) {
                    //not needed
                },
                openClickThrough: function(url) {
                    openAndTrackClickThrough(url);
                },
                sessionEnded: function() {
                    player.ads.endLinearAdMode();
                    if (!sharedElement) {} else {
                        sharedElement.style.display = "block";
                    }

                    vjsControls.show();

                    removePointerEventsForClick();


                    player.one('beforeplaylistitem', () => {
                        player.ready(() => {
                            if (!player.hasStarted_ && useShared) {
                                try {
                                    player.play();
                                } catch (e) {
                                    log('Could not detect if player has initiated' + e);
                                }
                            }
                        })
                    });

                    //Reset the plugin state
                    resetPlugin();
                }
            }
        })(this);
    };

    const registerPlugin = vjs.registerPlugin || vjs.plugin;
    registerPlugin('pulse', pulsePlugin);

})(window.videojs);
