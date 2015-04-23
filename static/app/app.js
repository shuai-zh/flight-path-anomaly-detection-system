/**
 * Created by NicolasZHANG on 4/19/15.
 */
$(document).ready(function () {
    var WIND_EFFECT_WEIGHT_ON_X = 20,
        WIND_EFFECT_WEIGHT_ON_Y = 20,
        WIND_EFFECT_WEIGHT_ON_Z = 0.4,
        WIND_EFFECT_WEIGHT_ON_SPEED = 0.05;

    var droneCruisingSpeed,
        droneCruisingAltitude,
        probabilityOfWindOnX,
        probabilityOfWindOnY,
        probabilityOfWindOnZ,
        maxWindSpeedOnX,
        maxWindSpeedOnY,
        maxWindSpeedOnZ,
        firstPathStartTime,
        lastPathEndTime,
        startAndEndPoints = [],
        droneAndPathCollection = [],
        activeDroneAndPath,
        flightPathCollection = [];

    var pathList = $('#pathList');
    var btnSimulateNewTrainingData = $('#btnSimulateNewTrainingData');
    var pageDimmer = $('#pageDimmer');
    pageDimmer.dimmer({
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
        url: '//cesiumjs.org/stk-terrain/world',
        requestWaterMask: true,
        requestVertexNormals: true
    });

    //Set the random number seed for consistent results.
    Cesium.Math.setRandomNumberSeed(3);

    //Enable depth testing so things behind the terrain disappear.
    //scene.globe.depthTestAgainstTerrain = true;


    // bind event handlers
    btnSimulateNewTrainingData.click(function () {
        $('#modalSimulateConfig')
            .modal({
                closable: false
            })
            .modal('show');
    });

    $('#btnSimulate').click(function () {
        btnSimulateNewTrainingData.hide();

        // get configuration from user input
        var form = $('#simulationConfigurationForm');
        droneCruisingSpeed = form.find('input[name="droneCruisingSpeed"]').val();
        droneCruisingAltitude = form.find('input[name="droneCruisingAltitude"]').val();
        probabilityOfWindOnX = form.find('input[name="probabilityOfWindOnX"]').val();
        probabilityOfWindOnY = form.find('input[name="probabilityOfWindOnY"]').val();
        probabilityOfWindOnZ = form.find('input[name="probabilityOfWindOnZ"]').val();
        maxWindSpeedOnX = form.find('input[name="maxWindSpeedOnX"]').val();
        maxWindSpeedOnY = form.find('input[name="maxWindSpeedOnY"]').val();
        maxWindSpeedOnZ = form.find('input[name="maxWindSpeedOnZ"]').val();

        if (flightPathCollection.length == 0) {
            // ask user to pick start and end point in the first time
            var n = noty({
                layout: 'centerRight',
                text: 'Double click on the globe to pick start and end point.',
                type: 'information',
                timeout: 5000
            });

            // select 2 points on the scene
            var step = 0;

            // add double click event handler for the cesium viewer
            var handler = new Cesium.ScreenSpaceEventHandler(scene.canvas);

            function onLeftDoubleClick(movement) {
                var cartesian = viewer.camera.pickEllipsoid(movement.position, ellipsoid);
                if (cartesian) {
                    var entity = entities.add({
                        position: cartesian,
                        point: {
                            pixelSize: 5,
                            color: Cesium.Color.RED,
                            outlineColor: Cesium.Color.WHITE,
                            outlineWidth: 2
                        },
                        label: {
                            font: '14pt monospace',
                            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                            outlineWidth: 2,
                            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                            pixelOffset: new Cesium.Cartesian2(0, -9)
                        }
                    });

                    startAndEndPoints.push(cartesian);

                    if (step === 0) {
                        entity.label.text = 'Start Point';
                    } else if (step === 1) {
                        entity.label.text = 'End Point';
                        handler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
                        simulatePath(startAndEndPoints[0], startAndEndPoints[1]);
                        showMenuButtons();
                        renderPathList();
                        btnSimulateNewTrainingData.show();
                        $('#btnToggleDataSheet').show();
                        pathList.fadeIn();
                    }
                    step++;
                }
            }

            handler.setInputAction(onLeftDoubleClick, Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
        } else {
            // hide all drones, paths and vertices
            showDroneAndPathInScene(-1);
            // use the same start and end points as user picked in the first time to simulate a different path
            simulatePath(startAndEndPoints[0], startAndEndPoints[1]);
            btnSimulateNewTrainingData.show();
            renderPathList();

            // show analyze button once flightPathCollection has more than 3 paths
            if (flightPathCollection.length > 1) {
                $('#btnAnalyzeAnomaly').show();
            }
        }
    });

    function showDroneAndPathInScene(indexToShow) {
        for (x in droneAndPathCollection) {
            var show = (indexToShow === -1 ? false : x === indexToShow);
            droneAndPathCollection[x]['droneAndPath'].show = show;
            flightPathCollection[x].show = show;
            for (y in droneAndPathCollection[x]['vertices']) {
                droneAndPathCollection[x]['vertices'][y].show = show;
            }

            if (x === indexToShow) {
                activeDroneAndPath = droneAndPathCollection[x]['droneAndPath'];

                //Set timeline to simulation bounds
                viewer.timeline.zoomTo(droneAndPathCollection[x].droneAndPath.availability.start, droneAndPathCollection[x].droneAndPath.availability.stop);
            }
        }

        // sync the path list
        renderPathList();
    }

    $('#btnAnalyzeAnomaly').click(function () {
        console.log(flightPathCollection);
        pageDimmer.dimmer('show');
        $.ajax({
            url: analyzeAnomalyUrl,
            method: 'POST',
            contentType: "application/json; charset=utf-8",
            dataType: "json",
            data: JSON.stringify(flightPathCollection)
        }).done(function (data) {
            if (console && console.log) {
                console.log("Sample of data:", data);
            }

            // render anomaly data
            renderAnomalyData(data.result);
            pageDimmer.dimmer('hide');
        });
    });

    function renderAnomalyData(anomalyData) {
        for (index in anomalyData) {
            for (subIndex in anomalyData[index]) {
                // skip the start, end point and set the color of the vertex
                if (subIndex == 0 || subIndex == anomalyData[index].length - 1) {
                    continue;
                }
                var anomalyScore = anomalyData[index][subIndex];
                var hexColor = getGreenToRed(anomalyScore * 100);

                var droneAndPath = droneAndPathCollection[index];
                var vertex = droneAndPath.vertices[subIndex - 1];
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
    $('#btnViewDrone').click(function () {
        viewer.trackedEntity = activeDroneAndPath;
    });

    function showMenuButtons() {
        $('#btnViewTopDown,#btnViewSide,#btnViewDrone').show();
    }

    function hideMenuButtons() {
        $('#btnViewTopDown,#btnViewSide,#btnViewDrone').hide();
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
            droneSpeed: droneCruisingSpeed
        });

        // simulate way points in between
        for (var i = 1; i < granularity; i++) {
            var cartographic = ellipsoidGeodesic.interpolateUsingFraction(i / granularity);
            cartographic.height = droneCruisingAltitude;

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

            // affect the drone speed on x and y
            var speed = droneCruisingSpeed;
            speed -= endPoint.x - startPoint.x == 0 ? 0 : windSpeedOnX * WIND_EFFECT_WEIGHT_ON_SPEED;
            speed -= endPoint.y - startPoint.y == 0 ? 0 : windSpeedOnY * WIND_EFFECT_WEIGHT_ON_SPEED;


            var affectedCartographic = Cesium.Ellipsoid.WGS84.cartesianToCartographic(cartesianPosition);


            var time = Cesium.JulianDate.addSeconds(startTime,
                shortestPathDistance / droneCruisingSpeed * i / granularity,
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
                droneSpeed: speed
            });

            // add vertices
            var vertex = entities.add({
                position: cartesianPosition,
                point: {
                    pixelSize: 8,
                    color: Cesium.Color.BLUE
                }
            });

            vertices.push(vertex);

        }

        var endTime = Cesium.JulianDate.addSeconds(startTime,
            shortestPathDistance / droneCruisingSpeed,
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
            droneSpeed: droneCruisingSpeed
        });

        // create path
        var droneAndPath = entities.add({
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

        droneAndPathCollection.push({droneAndPath: droneAndPath, vertices: vertices});
        activeDroneAndPath = droneAndPath;
        // use LagrangePolynomialApproximation to interpolate
        //drone.position.setInterpolationOptions({
        //    interpolationDegree: 5,
        //    interpolationAlgorithm: Cesium.LagrangePolynomialApproximation
        //});

        // track the drone
        viewer.zoomTo(entities);

        //Make sure viewer is at the desired time.
        clock.startTime = firstPathStartTime ? firstPathStartTime : startTime.clone();
        clock.stopTime = endTime.clone();
        clock.currentTime = startTime.clone();
        clock.clockRange = Cesium.ClockRange.LOOP_STOP; //Loop at the end
        clock.multiplier = 2;
        firstPathStartTime = startTime.clone();

        //Set timeline to simulation bounds
        viewer.timeline.zoomTo(startTime, endTime);

        // save the path into paths
        flightPathCollection.push({
            number: flightPathCollection.length,
            flightPath: flightPath,
            show: true
        });
    }


    function renderPathList() {
        $.get(pathListTemplatePath, function (template) {
            var rendered = Mustache.render(template, {paths: flightPathCollection});
            pathList.html(rendered);
            pathList.find('.header').click(function () {
                var index = this.getAttribute('data-index');
                showDroneAndPathInScene(index);
            });
        });

    }
});