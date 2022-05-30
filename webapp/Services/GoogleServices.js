var GoogleServices = {
    requestDistanceMatrix: async function (origins,destinations){
        function urlStrip(str){
            return str.replace(/\W+/gi,'+');
        }
        const formattedOrigins = origins.map(e => urlStrip(e)).join('","');
        const formattedDestinations = destinations.map(e => urlStrip(e)).join('","');
        const apiUrl = 'https://maps.googleapis.com/maps/api/';
        const distanceMatrixRoute = 'distancematrix/json?language=en-US&units=metric&origins={"'+formattedOrigins+'"}&destinations={"'+formattedDestinations+'"}';
        const apiKey = 'AIzaSyCqCbvsVBx8mFgyw5AYFAqBLhZ_w60-IS4'
        const response = await fetch(apiUrl+distanceMatrixRoute+'&key='+apiKey, {
          method: 'GET',
          headers: {
                   "Accept": "*/*",
                "Host": "maps.googleapis.com",
                  "Accept-Encoding": "gzip, deflate, br",
                  "Connection": "keep-alive"
            }
        });
        return response.json(); 
    },

    requestGeocode: async function (latitude,longitude){
        const apiUrl = 'https://maps.googleapis.com/maps/api/';
            const geolocationRoute = `geocode/json?latlng=${latitude},${longitude}`;
            const apiKey = 'AIzaSyCqCbvsVBx8mFgyw5AYFAqBLhZ_w60-IS4'
            const response = await fetch(apiUrl+geolocationRoute+'&key='+apiKey, {
            method: 'GET',
            headers: {
                    "Accept": "*/*",
                    "Host": "maps.googleapis.com",
                    "Accept-Encoding": "gzip, deflate, br",
                    "Connection": "keep-alive"
                }
            });
    
            return response.json;
    }
}
