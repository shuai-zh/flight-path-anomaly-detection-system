#!/usr/bin/env python
# ----------------------------------------------------------------------
# Numenta Platform for Intelligent Computing (NuPIC)
# Copyright (C) 2014, Numenta, Inc.  Unless you have an agreement
# with Numenta, Inc., for a separate license for this software code, the
# following terms and conditions apply:
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License version 3 as
# published by the Free Software Foundation.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
# See the GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program.  If not, see http://www.gnu.org/licenses.
#
# http://numenta.org/licenses/
# ----------------------------------------------------------------------

"""
A simple client to create a CLA anomaly detection model for geospatial data.
"""

import datetime

from nupic.frameworks.opf.modelfactory import ModelFactory

import model_params


ACCURACY_THRESHOLD = 500  # meters


def addTimeEncoders(params):
    params["modelParams"]["sensorParams"]["encoders"]["timestamp_timeOfDay"] = {
        "fieldname": u"timestamp",
        "name": u"timestamp_timeOfDay",
        "timeOfDay": (51, 9.5),
        "type": "DateEncoder"
    }
    return params


def setEncoderScale(params, scale):
    params["modelParams"]["sensorParams"]["encoders"]["vector"]["scale"] = \
        int(scale)
    return params


def createModel(useTimeEncoders, scale, verbose):
    params = model_params.MODEL_PARAMS
    if useTimeEncoders:
        params = addTimeEncoders(params)
    if scale:
        params = setEncoderScale(params, scale)
    if verbose:
        print "Model parameters:"
        print params
    model = ModelFactory.create(params)
    model.enableInference({"predictedField": "vector"})
    return model


def runGeospatialAnomaly(preprocessedData,
                         scale=False,
                         useTimeEncoders=False,
                         verbose=False):
    model = createModel(useTimeEncoders, scale, verbose)

    outputFormat = "%Y-%m-%dT%H:%M:%S"
    anomalyScoreCollection = []

    for index in enumerate(preprocessedData):
        record = index[1]
        anomalyScores = []
        for index1 in enumerate(record['flightPath']):
            trackPoint = index1[1]
            timestamp = datetime.datetime.fromtimestamp(int(trackPoint['timestamp']) / 1e3)
            longitude = float(trackPoint['longitude'])
            latitude = float(trackPoint['latitude'])
            speed = float(trackPoint['planeSpeed'])
            altitude = float(trackPoint['altitude'])
            # windSpeedX = float(trackPoint['windSpeedX'])
            # windSpeedY = float(trackPoint['windSpeedY'])
            # windSpeedZ = float(trackPoint['windSpeedZ'])

            modelInput = {
                "vector": (speed / 10.0, longitude, latitude, altitude)
            }

            if useTimeEncoders:
                modelInput["timestamp"] = timestamp

            result = model.run(modelInput)
            anomalyScore = result.inferences["anomalyScore"]

            anomalyScores.append(anomalyScore)

            if verbose:
                print "[{0}] - Anomaly score: {1}.".format(timestamp, anomalyScore)

        anomalyScoreCollection.append(anomalyScores)

        if verbose:
            print "Starting new sequence..."
        model.resetSequenceStates()

    print "Anomaly scores have been written to {0}".format(preprocessedData)
    return anomalyScoreCollection
