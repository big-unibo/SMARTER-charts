import axios from "axios";
import { getNestedProperty } from "../common/utils";

export class CommunicationService {

    /** Passing dataKey allows to get automatically extracted data nested in a certain specified way,
     * separetly returing thesis and device data. 
     * Not doing it allows to recieve hust the raw data.
    */
    async getChartData(environment, pathsParams, queryParams, endpoint, dataKey = null) {
        const response = await this.getAPI(environment, "/fieldCharts", pathsParams, queryParams, endpoint);
        if (response) {
            return dataKey ? 
                {
                    deviceId: response.deviceId,
                    binningId: response.binningId,
                    data: getNestedProperty(response, dataKey)
                } 
                : response;
        }
        return null;
    }

    async getAPI(environment, primaryPath, pathsParams, queryParams, endpoint) {
        return axios.get(this.buildURL(environment.host, primaryPath, pathsParams.thesisId, endpoint), {
            params: queryParams,
            headers: {
                Authorization: 'Bearer ' + environment.token
            }
        }).then(response => {
            if (response.data)
                return response.data;
            return null;
        }).catch(error => {
            console.error(`Error response: ${error}`)
            console.error(`Error on communication service: ${error.message}`)
            throw new Error(error.message);
        })
    }

    async getBinningInfo(environment, binningId, dataKey = null) {
        const response = await axios.get(this.buildURL(environment.host, "/profileBins", binningId), {
            headers: {
                Authorization: 'Bearer ' + environment.token
            }
        }).then(response => {
            if (response.data)
                return response.data;
            return null;
        }).catch(error => {
            console.error(`Error response: ${error}`)
            console.error(`Error on communication service: ${error.message}`)
            throw new Error(error.message);
        })
        
        if (response) {
            return dataKey ? getNestedProperty(response, dataKey) : response;
        }
        return null;
    }

    // async getFieldInfo(environment, pathsParams, params, endpoint) {
    //     const response = await this.getAPI(environment, "/fields", pathsParams, params, endpoint)
    //     return response;
    // }

    // async getWateringSchedule(environment, pathsParams, params, endpoint) {
    //     const response = await this.getAPI(environment, "/wateringSchedule", pathsParams, params, endpoint)
    //     return response;
    // }

    // async updateEvent(environment, endpoint, thesisIdentifier, newEvent) {
    //     return axios.put(this.buildURL(environment.host, "/wateringSchedule", undefined, endpoint), {
    //         source: thesisIdentifier.source,
    //         refStructureName: thesisIdentifier.refStructureName,
    //         companyName: thesisIdentifier.companyName,
    //         fieldName: thesisIdentifier.fieldName,
    //         sectorName: thesisIdentifier.sectorName,
    //         thesisName: thesisIdentifier.thesisName,
    //         ...newEvent
    //     }, {
    //         headers: {
    //             Authorization: 'Bearer ' + environment.token
    //         }
    //     }
    //     ).then(response => {
    //         console.log(`Success response: ${response.data}`)
    //         if (response.data)
    //             return response.data;
    //         return null;
    //     }).catch(error => {
    //         console.error(`Error response: ${error}`)
    //         console.error(`Error on communication service: ${error.message}`)
    //         throw new Error(error.message);
    //     })
    // }

    // async setOptimalStateByTimestamp(environment, endpoint, thesisIdentifier, timestamp){
    //     return axios.put(this.buildURL(environment.host, "/fields",thesisIdentifier,endpoint),{},{
    //         params: {
    //             imageTimestamp: timestamp
    //         },
    //         headers: {
    //             Authorization: 'Bearer ' + environment.token
    //         }
    //     }).then(response => {
    //         console.log(`Success response: ${response.data}`)
    //         if (response.data)
    //             return response.data;
    //         return null;
    //     }).catch(error => {
    //         console.error(`Error response: ${error}`)
    //         console.error(`Error on communication service: ${error.message}`)
    //         throw new Error(error.message);
    //     })
    // }

    // async setOptimalStateByMatrixId(environment, endpoint, thesisIdentifier, matrixId){
    //     return axios.put(this.buildURL(environment.host, "/fields",thesisIdentifier,endpoint),{},{
    //         params: {
    //             matrixId: matrixId
    //         },
    //         headers: {
    //             Authorization: 'Bearer ' + environment.token
    //         }
    //     }).then(response => {
    //         console.log(`Success response: ${response.data}`)
    //         if (response.data)
    //             return response.data;
    //         return null;
    //     }).catch(error => {
    //         console.error(`Error response: ${error}`)
    //         console.error(`Error on communication service: ${error.message}`)
    //         throw new Error(error.message);
    //     })
    // }

    buildURL(host, primaryPath, pathParam, endpoint = null) {
        let path = "";
        if (pathParam) {
            path = '/' + pathParam;
        }
        const endpointPart = endpoint ? '/' + endpoint : '';
        return host + primaryPath + path + endpointPart;
    }

}