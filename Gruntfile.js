

module.exports = function(grunt) {

    require("load-grunt-tasks")(grunt);

    var date = grunt.template.today('yyyy-mm-dd');
    var sourceBanner = '/* \n'                                                                             +
        '* !<%= pkg.name %> v<%= pkg.version %> built the: '+ date +'  | Pulse HTML5 plugin for Brightcove\n' +
        '* Copyright (c) <%= grunt.template.today("yyyy") %> by INVIDI, www.invidi.com \n'  +
        '* email: support@invidi.com \n'                                                       +
        '*/ \n';

    // Load the plugin tasks we need
    [
        "grunt-babel",
        "grunt-contrib-uglify",
        "grunt-contrib-clean",
        "grunt-contrib-copy",
        "grunt-contrib-concat",
    ].forEach(grunt.loadNpmTasks);

    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
        clean: {
            src: ['dist/']
        },
        concat: {
            pulse: {
                options: {
                    process: function(source, filepath) {
                        console.log(filepath);
                        if (filepath.indexOf('videojs.pulse.js') > -1) {
                            return source.replace('@VERSION', grunt.template.process('<%= pkg.version %>'));
                        }

                        return source;
                    },
                    banner: sourceBanner
                },
                src: 'src/*.js',
                dest: 'temp/temp.js'
            }
        },
        babel: {
            dist: {
                files: {
                    'dist/<%= pkg.name %>-<%= pkg.version %>.js': 'temp/temp.js'
                }
            }
        },
        //Minify
        uglify: {
            bridge: {
                options: {
                    //banner: sourceBanner,
                    mangle: {
                        except: ['error', 'format', 'request', 'model', 'parse', 'core', 'window', 'document', 'console']
                    }
                },
                files: {
                    'dist/<%= pkg.name %>-<%= pkg.version %>.min.js': ['dist/<%= pkg.name %>-<%= pkg.version %>.js' ]
                }
            },
        },
    });

    grunt.registerTask('default', [ 'clean', 'concat', 'babel', 'uglify' ]);
};
