import axios from "axios";
import { getNestedProperty } from "../common/utils";

const DRIPPER_SIGNAL_TYPE = "DRIPPER";

export class CommunicationService {

    async _request(method, url, options = {}) {
        const { params, data, token } = options;

        try {
            const response = await axios({
                method,
                url,
                params,
                data,
                headers: {
                    Authorization: token ? `Bearer ${token}` : undefined
                }
            });
            return response.data; 

        } catch (error) {
            this._handleError(error);
        }
    }

    _handleError(error) {
        if (error.response) {
            const status = error.response.status;
            const serverMessage = error.response.data?.message || error.response.statusText;
            
            console.warn(`API Error [${status}]:`, serverMessage);

            throw {
                isNetworkError: false,
                status: status,
                message: serverMessage, 
                originalError: error.response.data 
            };
        } 
        
        else if (error.request) {
            console.error("Network Error: No response received", error.message);
            throw {
                isNetworkError: true,
                message: "Impossibile contattare il server. Verifica la connessione.",
                status: 0
            };
        } 
        
        else {
            console.error("Request Setup Error", error.message);
            throw {
                isNetworkError: false,
                message: "Errore interno dell'applicazione.",
                status: -1
            };
        }
    }

    async getChartData(environment, pathsParams, queryParams, endpoint, dataKey = null) {
        const url = this.buildURL(environment.host, "/fieldCharts", pathsParams.thesisId, endpoint);
        
        const data = await this._request('GET', url, {
            params: queryParams,
            token: environment.token
        });

        if (!data) return null;

        return dataKey
            ? {
                deviceId: data.deviceId ?? null,
                binningId: data.binningId ?? null,
                unit: Array.isArray(data[0]?.signals)
                    ? data[0].signals[0]?.unit ?? null
                    : data[0]?.signals?.unit ?? null,
                data: getNestedProperty(data, dataKey)
            }
            : data;
    }

    async getBinningInfo(environment, binningId, dataKey = null) {
        const url = this.buildURL(environment.host, "/profileBins", binningId);
        
        const data = await this._request('GET', url, {
            token: environment.token
        });

        if (data && dataKey) {
            return getNestedProperty(data, dataKey);
        }
        return data;
    }

    async getDripperInfo(environment, pathsParams, queryParams, endpoint) {
        queryParams["signalTypes"] = [DRIPPER_SIGNAL_TYPE];
        const url = this.buildURL(environment.host, "/theses", pathsParams.thesisId, endpoint);

        const data = await this._request('GET', url, {
            params: queryParams,
            token: environment.token
        });

        if (data) {
            return getNestedProperty(data, "0.signals.0");
        }
        return null;
    }

    async getWateringSchedule(environment, pathsParams, queryParams, endpoint) {
        const url = this.buildURL(environment.host, "/wateringSchedule", pathsParams.sectorId, endpoint);
        
        return await this._request('GET', url, {
            params: queryParams,
            token: environment.token
        });
    }

    async updateEvent(environment, eventId, endpoint, updatedEvent) {
        const url = this.buildURL(environment.host, "/wateringSchedule", eventId, endpoint);
        
        return await this._request('PUT', url, {
            data: { ...updatedEvent },
            token: environment.token
        });
    }

    buildURL(host, primaryPath, pathParam = null, endpoint = null) {
        const p1 = pathParam ? `/${pathParam}` : '';
        const p2 = endpoint ? `/${endpoint}` : '';
        return `${host}${primaryPath}${p1}${p2}`;
    }
}