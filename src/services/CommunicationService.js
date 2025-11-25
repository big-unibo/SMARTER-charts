import axios from "axios";
import { getNestedProperty } from "../common/utils";

const DRIPPER_SIGNAL_TYPE = "DRIPPER"

export class CommunicationService {

    /** Passing dataKey allows to get automatically extracted data nested in a certain specified way,
     * separetly returing thesis and device data. 
     * Not doing it allows to recieve hust the raw data.
     * 
     * While unnesting data, it also tries to retrieve info about
     * deviceId, binningId and unit.
    */
    async getChartData(environment, pathsParams, queryParams, endpoint, dataKey = null) {
        const response = await this.getAPI(environment, "/fieldCharts", pathsParams, queryParams, endpoint);

        if (response) {
            return dataKey
                ? {
                    deviceId: response?.deviceId ?? null,
                    binningId: response?.binningId ?? null,
                    unit: Array.isArray(response[0]?.signals)
                        ? response[0].signals[0]?.unit ?? null
                        : response[0]?.signals?.unit ?? null,
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


    async getDripperInfo(environment, pathsParams, queryParams, endpoint) {
        queryParams["signalTypes"] = [DRIPPER_SIGNAL_TYPE]
        const response = await axios.get(this.buildURL(environment.host, "/theses", pathsParams.thesisId, endpoint), {
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

        if (response) {
            return getNestedProperty(response, "0.signals.0");
        }
        return null;
    }

    async getWateringSchedule(environment, pathsParams, queryParams, endpoint) {
        return await axios.get(this.buildURL(environment.host, "/sectors", pathsParams.sectorId, endpoint), {
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

    async updateEvent(environment, eventId, endpoint, updatedEvent) {
        return axios.put(this.buildURL(environment.host, "/wateringSchedule", eventId, endpoint), {
            ...updatedEvent
        }, {
            headers: {
                Authorization: 'Bearer ' + environment.token
            }
        }
        ).then(response => {
            if (response.data)
                return response.data;
            return null;
        }).catch(error => {
            console.error(`Error response: ${error}`)
            console.error(`Error on communication service: ${error.message}`)
            throw new Error(error.message);
        })
    }

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

    buildURL(host, primaryPath, pathParam = null, endpoint = null) {
        let path = "";
        if (pathParam) {
            path = '/' + pathParam;
        }
        const endpointPart = endpoint ? '/' + endpoint : '';
        return host + primaryPath + path + endpointPart;
    }

}