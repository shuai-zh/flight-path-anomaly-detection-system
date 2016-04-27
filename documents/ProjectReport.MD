# Problem definition
Suppose you have flying planes and you want to monitor their progress toward their target destination. Design algorithms to detect anomaly in their flight path and issue corrections so the plane can arrive its target location. Study graph algorithms and machine learning techniques to solve this problem. This is an open question as to how to design and implement this.

# Background
## Anomaly
> a·nom·a·ly Something that deviates from what is standard, normal, or expected.

Examples are provided to show anomalies that have been detected based location, speed and route pattern.
* Location – unexpected path deviations, new routes taken, detours.
* Speed – irregular slowdowns, speedups, bottlenecks, travel modes.
* Route Patterns – abnormal sequences of events within previously learned routes, such as U- turns, atypical stops, bypassed stops, etc.

## Hierarchical Temporal Memory
Hierarchical temporal memory (HTM) is an online machine learning model developed by Jeff Hawkins and Dileep George of Numenta, Inc. that models some of the structural and algorithmic properties of the neocortex. HTM is a biomimetic model based on the memory-prediction theory of brain function described by Jeff Hawkins in his book On Intelligence. HTM is a method for discovering and inferring the high-level causes of observed input patterns and sequences, thus building an increasingly complex model of the world.

Jeff Hawkins states that HTM does not present any new idea or theory, but combines existing ideas to mimic the neocortex with a simple design that provides a large range of capabilities. HTM combines and extends approaches used in Bayesian networks, spatial and temporal clustering algorithms, while using a tree-shaped hierarchy of nodes that is common in neural networks.
### NuPIC
NuPIC is a Python / C++ open source project that implements HTM as described in the HTM White Paper. For an introduction to the project, watch the presentation below, given at the Open Source Conference (OSCON) in 2013.

## Geographic Information System
A geographic information system (GIS) is a system designed to capture, store, manipulate, analyze, manage, and present all types of spatial or geographical data. 

### Cesium.js
Cesium is a JavaScript library for creating 3D globes and 2D maps in a web browser without a plugin. It uses WebGL for hardware-accelerated graphics, and is cross-platform, cross-browser, and tuned for dynamic-data visualization. Cesium is open source under the Apache 2.0 license. It is free for commercial and non-commercial use.

# Approach
There are three steps in solving this problem:
* Simulate the plane flight path
* Analyze the flight path using HTM
* Visualize the anomaly detection result

## plane path simulation
1. Let the user pick start and end points arbitrarily on the globe
2. Calculate the ellipsoid geodesic(Great Circle) surface distance between the 2 points
3. Calculate the granularity of waypoints to be generated
4. Generate each waypoint on the 'Great Circle' and exert random wind influences on the position and instantaneous velocity of each waypoint 
5. Repeat a number of times to generate several plane flight paths for the same start and end points
6. Send the generated plane flight paths to server to analyze

## plane anomaly detection analysis
1. Build the HTM Model with parameters (type as Cortical Learning Algorithm, inference type as Temporal Anomaly, encoder as Geospatial Coordinate Encoder, etc)
2. Run the model with the plane flight paths data and calculate the anomaly score
3. Send back the anomaly scores to the client

## Anomaly detection visualization
1. Calculate colors between red and green (green represents normal and red for anomalous) with the anomaly scores returned by the server
2. Render each waypoint with the calculated colors
3. Render the plane animation for the flight paths

# Main technologies used in the application
* [Nupic](https://github.com/numenta/nupic) and [nupic.geospatial](nupic.geospatial) as Cortical Learning Algorithm
* [Flask](http://flask.pocoo.org/) as the web framework
* [Cesium.js](http://cesiumjs.org/) as the 3D GIS and visualization platform


# Conclusions
After experiments and simulations with this application, I can now draw several conclusions:

* The HTM as one of the implementations of CLA can help with plane flight path anomaly detection effectively with Geospatial Coordinate Encoder
* For the same start and end points, the more history flight path data provided, the easier for the HTM algorithm to provide reasonable and intelligent results
* The plane instantaneous velocities greatly influence the speed for the HTM algorithm to calculate the anomaly scores. As the increase in velocity will result in exponential increase in the generating time of a coordinate's SDR(Sparse Distribution Representations) 

# Things could be done in the future
* Terrain collision detection with terrain data and plane instantaneous altitudes
* Enable real time anomaly detection with real time GPS data

# References
* UAV introduction. Retrieved from http://www.theuav.com/
* "Hierarchical temporal memory" in Wikipedia: The Free Encyclopedia; Retrieved from http://en.wikipedia.org/wiki/Hierarchical_temporal_memory
* Numanta. HIERARCHICAL TEMPORAL MEMORY including HTM Cortical Learning Algorithms. Retrieved from http://numenta.com/assets/pdf/whitepapers/hierarchical-temporal-memory-cortical-learning-algorithm-0.2.1-en.pdf
* Numenta. Geospatial Tracking White Paper. Retrieved from http://numenta.com/assets/pdf/whitepapers/Geospatial%20Tracking%20White%20Paper.pdf
* "Geographic information system" in Wikipedia: The Free Encyclopedia; Retrieved from 
http://en.wikipedia.org/wiki/Geographic_information_system