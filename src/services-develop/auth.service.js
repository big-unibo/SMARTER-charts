import axios from 'axios'
import hashPassword from '@/utils-develop/hashPassword';

const axiosInstance = axios.create({
    baseURL: import.meta.env.VITE_BACKEND_ADDRESS
});

class AuthService {

    isUserLoggedIn() {
        const token = JSON.parse(localStorage.getItem('appToken'));
        return !!token;
    }

    async login(user) {
        try {
            const response = await axiosInstance.post('/login', {
                email: user.authEmail,
                password: user.authPass,
            });
            if (response.data.token) {
                localStorage.setItem('appToken', JSON.stringify(response.data.token));
            }
        } catch (error) {
            console.log(error);
            throw Error(`Authentication failed: ${error.message}`);
        }
    }

    logout(){
        localStorage.removeItem('appToken');
    }

    authHeader(){
        const tokenItem = localStorage.getItem('appToken')
        const token = JSON.parse(tokenItem);
        if(token)
            return token;
        else return undefined;
    }

    // async retrieveUserFieldPermissions(token, timeFilterFrom, timeFilterTo) {
    //     let params = undefined
    //     if (timeFilterFrom && timeFilterTo) {
    //         params = { timeFilterFrom: timeFilterFrom, timeFilterTo: timeFilterTo }
    //     }
    //     return axiosInstance.get('/userFields', {
    //         headers: {
    //             'Authorization': 'Bearer ' + token
    //         },
    //         params: params
    //     }).then(response => {
    //         if(response.data)
    //             return response.data
    //     }).catch(error => {
    //         console.log(error)
    //         console.error(`Get fields request failed: ${error.message}`)
    //         this.logout()
    //     });
    // }

}

export default new AuthService();