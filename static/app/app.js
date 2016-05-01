/**
 * Created by NicolasZHANG on 4/19/15.
 */
$(document).ready(function () {
    var WIND_EFFECT_WEIGHT_ON_X = 20,
        WIND_EFFECT_WEIGHT_ON_Y = 20,
        WIND_EFFECT_WEIGHT_ON_Z = 0.4,
        WIND_EFFECT_WEIGHT_ON_SPEED = 0.05;

    var planeCruisingSpeed,
        planeCruisingAltitude,
        probabilityOfWindOnX,
        probabilityOfWindOnY,
        probabilityOfWindOnZ,
        maxWindSpeedOnX,
        maxWindSpeedOnY,
        maxWindSpeedOnZ,
        numberOfPaths,
        firstPathStartTime,
        lastPathEndTime,
        startAndEndPoints = [],
        planeAndPathCollection = [],
        activePlaneAndPath,
        flightPathCollection = [],
        airports;

    var pathList = $('#pathList');
    var btnSimulateNewTrainingData = $('#btnSimulateNewTrainingData');
    var btnSimulateAnomalyData = $('#btnSimulateAnomalyData');

    // initialize the dimmer

    $('body .dimmer').dimmer({
        closable: false
    });

    // init the cesium viewer
    var viewer = new Cesium.Viewer('cesiumContainer', {
        terrainProviderViewModels: [], //Disable terrain changing
        infoBox: false, //Disable InfoBox widget
        selectionIndicator: false //Disable selection indicator
    });

    var scene = viewer.scene;
    var clock = viewer.clock;
    var entities = viewer.entities;
    var ellipsoid = scene.globe.ellipsoid;

    //Enable lighting based on sun/moon positions
    scene.globe.enableLighting = false;

    //Use STK World Terrain
    viewer.terrainProvider = new Cesium.CesiumTerrainProvider({
        url: 'https://assets.agi.com/stk-terrain/world',
        requestWaterMask: true,
        requestVertexNormals: true
    });

    //Set the random number seed for consistent results.
    Cesium.Math.setRandomNumberSeed(3);

    //Enable depth testing so things behind the terrain disappear.
    //scene.globe.depthTestAgainstTerrain = true;

    // var dataSource = Cesium.GeoJsonDataSource.load('static/data/airports.geojson');
    // viewer.dataSources.add(dataSource);
    // // viewer.zoomTo(dataSource);
    //
    // dataSource.then(function (ds) {
    //
    //     var airportEntities = ds.entities.values;
    //
    //     for (var i = 0; i < airportEntities.length; i++) {
    //         var entity = airportEntities[i];
    //         entity.billboard = undefined;
    //         entity.point = new Cesium.PointGraphics({
    //             color: Cesium.Color.CRIMSON,
    //             pixelSize: 5
    //         });
    //         entity.label = new Cesium.LabelGraphics({
    //             text: entity.properties.name,
    //             translucencyByDistance: new Cesium.NearFarScalar(1.5e2, 1.0, 5.0e5, 0.0)
    //         });
    //     }
    // });

    var dlFrom = $('#dlFrom'),
        dlTo = $('#dlTo');

    // load the airport data from geojson
    $.getJSON('static/data/us_airports.geojson')
        .done(function (data) {
            airports = data;
            // populate the from and to selects
            var sortedFeatures = _.sortBy(data.features, function (el) {
                return el.properties.city;
            });
            var options = [];

            // options.push('<option value="">City - Airport</option>');
            for (var i in sortedFeatures) {
                options.push('<option value="',
                    sortedFeatures[i].properties.id, '">',
                    sortedFeatures[i].properties.city + ' - ' + sortedFeatures[i].properties.name, '</option>');
            }
            var optionsStr = options.join('');

            dlFrom.html(optionsStr);
            dlTo.html(optionsStr);

            $('#dlFrom,#dlTo').dropdown();
        });


    // bind event handlers
    btnSimulateNewTrainingData.click(function () {
        $('#modalSimulateConfig')
            .modal({
                // blurring: false,
                closable: false
            })
            .modal('show');
    });

    var fromAirport,
        toAirport;

    $('#btnSimulate').click(function () {
        btnSimulateNewTrainingData.hide();


        // clear up everything to a fresh start
        entities.removeAll();
        startAndEndPoints = [];
        planeAndPathCollection = [];
        flightPathCollection = [];

        // get configuration from user input
        var selectedFromAirportId = dlFrom.val();
        var selectedToAirportId = dlTo.val();


        // get the coordinates of the from and to airports
        for (var i in airports.features) {
            var airport = airports.features[i];

            if (!(fromAirport && toAirport)) {
                if (airport.properties.id == selectedFromAirportId) {
                    fromAirport = airport;
                }

                if (airport.properties.id == selectedToAirportId) {
                    toAirport = airport;
                }
            } else {
                break;
            }
        }

        var form = $('#simulationConfigurationForm');
        planeCruisingSpeed = form.find('input[name="planeCruisingSpeed"]').val();
        planeCruisingAltitude = form.find('input[name="planeCruisingAltitude"]').val();
        probabilityOfWindOnX = form.find('input[name="probabilityOfWindOnX"]').val();
        probabilityOfWindOnY = form.find('input[name="probabilityOfWindOnY"]').val();
        probabilityOfWindOnZ = form.find('input[name="probabilityOfWindOnZ"]').val();
        maxWindSpeedOnX = form.find('input[name="maxWindSpeedOnX"]').val();
        maxWindSpeedOnY = form.find('input[name="maxWindSpeedOnY"]').val();
        maxWindSpeedOnZ = form.find('input[name="maxWindSpeedOnZ"]').val();
        numberOfPaths = form.find('input[name="numberOfPaths"]').val();

        var fromAirportCartesian = Cesium.Cartesian3.fromDegrees(fromAirport.geometry.coordinates[0], fromAirport.geometry.coordinates[1]);
        var toAirportCartesian = Cesium.Cartesian3.fromDegrees(toAirport.geometry.coordinates[0], toAirport.geometry.coordinates[1]);

        // add airport markers
        addStartAndEndPointMarker(fromAirportCartesian, fromAirport.properties.name + ' - ' + fromAirport.properties.city);
        addStartAndEndPointMarker(toAirportCartesian, toAirport.properties.name + ' - ' + toAirport.properties.city);

        for (var i = 0; i < numberOfPaths; i++) {
            simulatePath(fromAirportCartesian, toAirportCartesian);
        }


        showMenuButtons();
        renderPathList();
        showPlaneAndPathInScene(0);
        btnSimulateAnomalyData.show();
        $('#btnToggleDataSheet').show();

        pathList.fadeIn();

        // zoom to the path
        viewer.zoomTo(entities);

        // if (flightPathCollection.length == 0) {
        //     // ask user to pick start and end point in the first time
        //     var n = noty({
        //         layout: 'centerRight',
        //         text: 'Double click on the globe to pick start and end point.',
        //         type: 'information',
        //         timeout: 5000
        //     });
        //
        //     // select 2 points on the scene
        //     var step = 0;
        //
        //     // add double click event handler for the cesium viewer
        //     var handler = new Cesium.ScreenSpaceEventHandler(scene.canvas);
        //
        //     function onLeftDoubleClick(movement) {
        //         var cartesian = viewer.camera.pickEllipsoid(movement.position, ellipsoid);
        //         if (cartesian) {
        //             var entity = entities.add({
        //                 position: cartesian,
        //                 point: {
        //                     pixelSize: 5,
        //                     color: Cesium.Color.RED,
        //                     outlineColor: Cesium.Color.WHITE,
        //                     outlineWidth: 2
        //                 },
        //                 label: {
        //                     font: '14pt monospace',
        //                     style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        //                     outlineWidth: 2,
        //                     verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        //                     pixelOffset: new Cesium.Cartesian2(0, -9)
        //                 }
        //             });
        //
        //             startAndEndPoints.push(cartesian);
        //
        //             if (step === 0) {
        //                 entity.label.text = 'Start Point';
        //             } else if (step === 1) {
        //                 entity.label.text = 'End Point';
        //                 handler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
        //                 simulatePath(startAndEndPoints[0], startAndEndPoints[1]);
        //                 showMenuButtons();
        //                 renderPathList();
        //                 btnSimulateNewTrainingData.show();
        //                 $('#btnToggleDataSheet').show();
        //                 pathList.fadeIn();
        //             }
        //             step++;
        //         }
        //     }
        //
        //     handler.setInputAction(onLeftDoubleClick, Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
        // } else {
        //     // hide all planes, paths and vertices
        //     showPlaneAndPathInScene(-1);
        //     // use the same start and end points as user picked in the first time to simulate a different path
        //     simulatePath(startAndEndPoints[0], startAndEndPoints[1]);
        //     btnSimulateNewTrainingData.show();
        //     renderPathList();
        //
        //     // show analyze button once flightPathCollection has more than 3 paths
        //     if (flightPathCollection.length > 1) {
        //         $('#btnAnalyzeAnomaly').show();
        //     }
        // }
    });

    btnSimulateAnomalyData.click(function () {
        $('#modalAnomalousDataConfig')
            .modal({
                // blurring: true,
                closable: false
            })
            .modal('show');
    });

    // simulate anmalous flight paths
    $('#btnSimulateAnomalousData').click(function () {
        var form = $('#anomalousDataForm');
        planeCruisingSpeed = form.find('input[name="planeCruisingSpeed"]').val();
        planeCruisingAltitude = form.find('input[name="planeCruisingAltitude"]').val();
        probabilityOfWindOnX = form.find('input[name="probabilityOfWindOnX"]').val();
        probabilityOfWindOnY = form.find('input[name="probabilityOfWindOnY"]').val();
        probabilityOfWindOnZ = form.find('input[name="probabilityOfWindOnZ"]').val();
        maxWindSpeedOnX = form.find('input[name="maxWindSpeedOnX"]').val();
        maxWindSpeedOnY = form.find('input[name="maxWindSpeedOnY"]').val();
        maxWindSpeedOnZ = form.find('input[name="maxWindSpeedOnZ"]').val();
        numberOfPaths = form.find('input[name="numberOfPaths"]').val();

        var fromAirportCartesian = Cesium.Cartesian3.fromDegrees(fromAirport.geometry.coordinates[0], fromAirport.geometry.coordinates[1]);
        var toAirportCartesian = Cesium.Cartesian3.fromDegrees(toAirport.geometry.coordinates[0], toAirport.geometry.coordinates[1]);

        for (var i = 0; i < numberOfPaths; i++) {
            simulatePath(fromAirportCartesian, toAirportCartesian);
        }

        renderPathList();
        showPlaneAndPathInScene(-1);


        if (flightPathCollection.length > 1) {
            $('#btnAnalyzeAnomaly').show();
        }

        // zoom to the path
        viewer.zoomTo(entities);
    });
    function showPlaneAndPathInScene(indexToShow) {
        if (indexToShow == -1) {
            // show the last path
            indexToShow = planeAndPathCollection.length - 1;
        }
        // remove previous entities
        entities.removeAll();

        // add back start and end point
        if (startAndEndPoints) {
            entities.add(startAndEndPoints[0]);
            entities.add(startAndEndPoints[1]);
        }

        for (var x in planeAndPathCollection) {
            var show = (indexToShow == -1 ? false : x == indexToShow);
            // planeAndPathCollection[x].planeAndPath.show = show;
            if (indexToShow == x) {
                entities.add(planeAndPathCollection[x].planeAndPath);
                for (var y in planeAndPathCollection[x].vertices) {
                    // planeAndPathCollection[x].vertices[y].show = show;
                    entities.add(planeAndPathCollection[x].vertices[y]);
                }

                activePlaneAndPath = planeAndPathCollection[x].planeAndPath;

                //Set timeline to simulation bounds
                var startTime = planeAndPathCollection[x].planeAndPath.availability.start;
                var endTime = planeAndPathCollection[x].planeAndPath.availability.stop;

                //Make sure viewer is at the desired time.
                clock.startTime = startTime.clone();
                clock.stopTime = endTime.clone();
                clock.currentTime = startTime.clone();
                clock.clockRange = Cesium.ClockRange.UNBOUNDED; //Loop at the end
                clock.multiplier = 2;


                //Set timeline to simulation bounds
                viewer.timeline.zoomTo(startTime, endTime);
            }

            flightPathCollection[x].show = show;
        }

        // sync the path list
        renderPathList();


    }

    $('#btnAnalyzeAnomaly').click(function () {
        $('body .dimmer').dimmer('show');
        $.ajax({
            url: analyzeAnomalyUrl,
            method: 'POST',
            contentType: "application/json; charset=utf-8",
            dataType: "json",
            data: JSON.stringify(flightPathCollection)
        }).done(function (data) {
            // render anomaly data
            renderAnomalyData(data.result);
            $('body .dimmer').dimmer('hide');
        });
    });

    function addStartAndEndPointMarker(cartesian, text) {
        var marker = new Cesium.Entity({
            position: cartesian,
            point: {
                color: Cesium.Color.RED,
                pixelSize: 6
            },
            label: {
                text: text,
                pixelOffset: new Cesium.Cartesian2(0.0, -20.0),
                font: '20px sans-serif'
            }
        });

        startAndEndPoints.push(marker);
        entities.add(marker);
    }

    function renderAnomalyData(anomalyData) {
        for (var index in anomalyData) {
            for (var subIndex in anomalyData[index]) {
                // skip the start, end point and set the color of the vertex
                if (subIndex == 0 || subIndex == anomalyData[index].length - 1) {
                    continue;
                }
                var anomalyScore = anomalyData[index][subIndex];
                var hexColor = getGreenToRed(anomalyScore * 100);

                var planeAndPath = planeAndPathCollection[index];
                var vertex = planeAndPath.vertices[subIndex - 1];
                vertex.point.color = Cesium.Color.fromCssColorString('#' + hexColor);
            }
        }
    }

    /* From http://stackoverflow.com/questions/5623838/rgb-to-hex-and-hex-to-rgb */

    function rgbToHex(r, g, b) {
        return ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
    }


    function getGreenToRed(percent) {
        percent = 100 - percent;
        r = percent < 50 ? 255 : Math.floor(255 - (percent * 2 - 100) * 255 / 100);
        g = percent > 50 ? 255 : Math.floor((percent * 2) * 255 / 100);
        return rgbToHex(r, g, 0);
    }


    $('#btnToggleDataSheet').click(function () {
        pathList.fadeToggle()
    });

    $('#btnViewTopDown').click(function () {
        viewer.trackedEntity = undefined;
        viewer.zoomTo(viewer.entities, new Cesium.HeadingPitchRange(0, Cesium.Math.toRadians(-90)));
    });
    $('#btnViewSide').click(function () {
        viewer.trackedEntity = undefined;
        viewer.zoomTo(viewer.entities, new Cesium.HeadingPitchRange(Cesium.Math.toRadians(-90), Cesium.Math.toRadians(-15), 75000));
    });
    $('#btnViewPlane').click(function () {
        viewer.trackedEntity = activePlaneAndPath;
    });

    function showMenuButtons() {
        $('#btnViewTopDown,#btnViewSide,#btnViewPlane').show();
    }

    function hideMenuButtons() {
        $('#btnViewTopDown,#btnViewSide,#btnViewPlane').hide();
    }

    function getRandomArbitrary(min, max) {
        return Math.random() * (max - min) + min;
    }

    function getRandomInt(min, max) {
        return Math.floor(Math.random() * (max - min)) + min;
    }

    function convertJulianDateToUnixDate(julianDate) {
        return Cesium.JulianDate.toDate(julianDate).getTime() + new Date().getTimezoneOffset() * 60000;
    }

    function simulatePath(startPoint, endPoint) {
        //Set bounds of our simulation time
        var startTime;
        if (lastPathEndTime) {
            // start a new path 60 seconds after the previous one ended
            startTime = Cesium.JulianDate.addSeconds(lastPathEndTime, 60, new Cesium.JulianDate());
        } else {
            startTime = Cesium.JulianDate.now();
            firstPathStartTime = startTime;
        }

        var startPointCartographic = ellipsoid.cartesianToCartographic(startPoint);
        var endPointCartographic = ellipsoid.cartesianToCartographic(endPoint);
        var ellipsoidGeodesic = new Cesium.EllipsoidGeodesic(startPointCartographic, endPointCartographic, ellipsoid);
        var shortestPathDistance = ellipsoidGeodesic.surfaceDistance;
        var granularity = shortestPathDistance / 30000 + 5;
        var polylinePositions = new Cesium.SampledPositionProperty();
        var flightPath = [];
        var vertices = [];

        // startTime point
        polylinePositions.addSample(startTime, startPoint);
        flightPath.push({
            timestamp: convertJulianDateToUnixDate(startTime),
            longitude: Cesium.Math.toDegrees(startPointCartographic.longitude),
            latitude: Cesium.Math.toDegrees(startPointCartographic.latitude),
            altitude: startPointCartographic.height,
            windSpeedX: 0.0,
            windSpeedY: 0.0,
            windSpeedZ: 0.0,
            planeSpeed: planeCruisingSpeed
        });

        // simulate way points in between
        for (var i = 1; i < granularity; i++) {
            var cartographic = ellipsoidGeodesic.interpolateUsingFraction(i / granularity);
            cartographic.height = planeCruisingAltitude;

            var cartesianPosition = Cesium.Ellipsoid.WGS84.cartographicToCartesian(cartographic);

            // simulate the wind effect
            var windEffectOnX = 0.0,
                windEffectOnY = 0.0,
                windEffectOnZ = 0.0,
                windSpeedOnX = 0.0,
                windSpeedOnY = 0.0,
                windSpeedOnZ = 0.0;


            if (getRandomInt(1, 11) <= probabilityOfWindOnX) {
                windSpeedOnX = getRandomArbitrary(-maxWindSpeedOnX, maxWindSpeedOnX);
                windEffectOnX = windSpeedOnX * WIND_EFFECT_WEIGHT_ON_X;
            }
            if (getRandomInt(1, 11) <= probabilityOfWindOnY) {
                windSpeedOnY = getRandomArbitrary(-maxWindSpeedOnY, maxWindSpeedOnY);
                windEffectOnY = windSpeedOnY * WIND_EFFECT_WEIGHT_ON_Y;
            }
            if (getRandomInt(1, 11) <= probabilityOfWindOnZ) {
                windSpeedOnZ = getRandomArbitrary(-maxWindSpeedOnZ, maxWindSpeedOnZ);
                windEffectOnZ = windSpeedOnZ * WIND_EFFECT_WEIGHT_ON_Z;
            }

            // affect the flight path
            cartesianPosition.x += windEffectOnX;
            cartesianPosition.y += windEffectOnY;
            cartesianPosition.z += windEffectOnZ;

            // affect the plane speed on x and y
            var speed = planeCruisingSpeed;
            speed -= endPoint.x - startPoint.x == 0 ? 0 : windSpeedOnX * WIND_EFFECT_WEIGHT_ON_SPEED;
            speed -= endPoint.y - startPoint.y == 0 ? 0 : windSpeedOnY * WIND_EFFECT_WEIGHT_ON_SPEED;


            var affectedCartographic = Cesium.Ellipsoid.WGS84.cartesianToCartographic(cartesianPosition);


            var time = Cesium.JulianDate.addSeconds(startTime,
                shortestPathDistance / planeCruisingSpeed * i / granularity,
                new Cesium.JulianDate());

            polylinePositions.addSample(time, cartesianPosition);
            flightPath.push({
                timestamp: convertJulianDateToUnixDate(time),
                longitude: Cesium.Math.toDegrees(affectedCartographic.longitude),
                latitude: Cesium.Math.toDegrees(affectedCartographic.latitude),
                altitude: affectedCartographic.height,
                windSpeedX: windSpeedOnX,
                windSpeedY: windSpeedOnY,
                windSpeedZ: windEffectOnZ,
                planeSpeed: speed
            });

            // add vertices
            var vertex = new Cesium.Entity({
                position: cartesianPosition,
                point: {
                    pixelSize: 8,
                    color: Cesium.Color.BLUE
                }
            });

            vertices.push(vertex);

        }

        var endTime = Cesium.JulianDate.addSeconds(startTime,
            shortestPathDistance / planeCruisingSpeed,
            new Cesium.JulianDate());
        lastPathEndTime = endTime;

        // end point
        polylinePositions.addSample(endTime, endPoint);
        flightPath.push({
            timestamp: convertJulianDateToUnixDate(endTime),
            longitude: Cesium.Math.toDegrees(endPointCartographic.longitude),
            latitude: Cesium.Math.toDegrees(endPointCartographic.latitude),
            altitude: endPointCartographic.height,
            windSpeedX: 0.0,
            windSpeedY: 0.0,
            windSpeedZ: 0.0,
            planeSpeed: planeCruisingSpeed
        });

        // create path
        var planeAndPath = new Cesium.Entity({
            //Set the entity availability to the same interval as the simulation time.
            availability: new Cesium.TimeIntervalCollection([new Cesium.TimeInterval({
                start: startTime,
                stop: endTime
            })]),

            //Use our computed positions
            position: polylinePositions,

            //Automatically compute orientation based on position movement.
            orientation: new Cesium.VelocityOrientationProperty(polylinePositions),

            //Load the Cesium plane model to represent the entity
            model: {
                uri: aircraftModelPath,
                minimumPixelSize: 64
            },

            //Show the path as a pink line sampled in 1 second increments.
            path: {
                resolution: 1,
                width: 2,
                material: Cesium.Color.WHITE
            }
        });

        planeAndPathCollection.push({planeAndPath: planeAndPath, vertices: vertices});
        // activePlaneAndPath = planeAndPath;
        // use LagrangePolynomialApproximation to interpolate
        planeAndPath.position.setInterpolationOptions({
            interpolationDegree: 5,
            interpolationAlgorithm: Cesium.LagrangePolynomialApproximation
        });

        // track the plane
        firstPathStartTime = startTime.clone();

        // save the path into paths
        flightPathCollection.push({
            number: flightPathCollection.length,
            flightPath: flightPath,
            show: false
        });
    }


    function renderPathList() {
        $.get(pathListTemplatePath, function (template) {
            var rendered = Mustache.render(template, {paths: flightPathCollection});
            pathList.html(rendered);
            pathList.find('.link.item').click(function () {
                var index = $(this).find('.header').data('index');
                showPlaneAndPathInScene(index);
            });
        });

    }
});