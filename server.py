from flask import Flask, render_template, request, jsonify

from htm.geospatial_anomaly import runGeospatialAnomaly


app = Flask(__name__)


@app.route('/')
def index():
    return render_template("index.html")


@app.route('/simulate')
def simulate():
    return render_template("simulate.html")


@app.route('/analyze-anomaly', methods=['POST'])
def analyze():
    flightPathCollection = request.get_json()
    # print flightPathCollection
    anomalyScoreCollection = runGeospatialAnomaly(flightPathCollection, verbose=False)

    return jsonify(result=anomalyScoreCollection)


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=3000, debug=True)
