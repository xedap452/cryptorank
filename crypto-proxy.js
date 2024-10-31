const { HttpsProxyAgent } = require('https-proxy-agent');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { DateTime } = require('luxon');
const colors = require('colors');
const readline = require('readline');

class Cryptorank {
    constructor() {
        const tokenFile = path.join(__dirname, 'token.txt');
        const proxyFile = path.join(__dirname, 'proxy.txt');
        
        this.tokens = fs.readFileSync(tokenFile, 'utf8').replace(/\r/g, '').split('\n').filter(Boolean);
        this.proxies = fs.readFileSync(proxyFile, 'utf8').replace(/\r/g, '').split('\n').filter(Boolean);
        
        if (this.tokens.length !== this.proxies.length) {
            throw new Error('Số lượng token và proxy phải bằng nhau.');
        }
    }
    
    headers(token) {
        return {
            "Accept": "*/*",
            "Accept-Encoding": "gzip, deflate, br",
            "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",
            "Authorization": token,
            "Content-Type": "application/json",
            "Origin": "https://tma.cryptorank.io",
            "Referer": "https://tma.cryptorank.io/",
            "Sec-Ch-Ua": '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
            "Sec-Ch-Ua-Mobile": "?0",
            "Sec-Ch-Ua-Platform": '"Windows"',
            "Sec-Fetch-Dest": "empty",
            "Sec-Fetch-Mode": "cors",
            "Sec-Fetch-Site": "same-site",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        };
    }

    createAxiosInstance(proxy) {
        return axios.create({
            httpsAgent: new HttpsProxyAgent(proxy)
        });
    }

    async getAccount(axiosInstance, token) {
        const url = `https://api.cryptorank.io/v0/tma/account`;
        const headers = this.headers(token);
        return axiosInstance.get(url, { headers });
    }

    async claimFarm(axiosInstance, token) {
        const url = `https://api.cryptorank.io/v0/tma/account/end-farming`;
        const headers = this.headers(token);
        return axiosInstance.post(url, {}, { headers });
    }

    async startFarm(axiosInstance, token) {
        const url = `https://api.cryptorank.io/v0/tma/account/start-farming`;
        const headers = this.headers(token);
        return axiosInstance.post(url, {}, { headers });
    }

    log(msg) {
        console.log(`[*] ${msg}`);
    }

    async checkProxyIP(proxy) {
        try {
            const proxyAgent = new HttpsProxyAgent(proxy);
            const response = await axios.get('https://api.ipify.org?format=json', {
                httpsAgent: proxyAgent
            });
            if (response.status === 200) {
                return response.data.ip;
            } else {
                throw new Error(`Không thể kiểm tra IP của proxy. Status code: ${response.status}`);
            }
        } catch (error) {
            throw new Error(`Error khi kiểm tra IP của proxy: ${error.message}`);
        }
    }

    async waitWithCountdown(seconds) {
        for (let i = seconds; i >= 0; i--) {
            readline.cursorTo(process.stdout, 0);
            process.stdout.write(`[*] Chờ ${i} giây để tiếp tục...`);
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        console.log('');
    }

    async getTasks(axiosInstance, token) {
        const url = `https://api.cryptorank.io/v0/tma/account/tasks`;
        const headers = this.headers(token);
        return axiosInstance.get(url, { headers });
    }
    
    async claimTask(axiosInstance, token, taskId) {
        const url = `https://api.cryptorank.io/v0/tma/account/claim/task/${taskId}`;
        const headers = this.headers(token);
        return axiosInstance.post(url, {}, { headers });
    }
    
    async processTasks(axiosInstance, token) {
        try {
            const tasksResponse = await this.getTasks(axiosInstance, token);
            const tasks = tasksResponse.data;

            for (const task of tasks) {
                const { id, name, isDone } = task;

                if (!isDone) {
                    try {
                        await this.claimTask(axiosInstance, token, id);
                        this.log(`${'Làm nhiệm vụ'.yellow} ${name} ${'thành công!'.green}`);
                    } catch (claimError) {
                        this.log(`${'Làm nhiệm vụ'.yellow} ${name} ${'thất bại!'.red}`);
                    }
                } else {
                    this.log(`${'Nhiệm vụ'.cyan} ${name} ${'đã hoàn thành trước đó.'.gray}`);
                }
            }
        } catch (error) {
            this.log(`${'Lỗi khi xử lý tasks:'.red} ${error.message}`);
            console.error(error);
        }
    }
    
    async claimBuddies(axiosInstance, token) {
        const url = `https://api.cryptorank.io/v0/tma/account/claim/buddies`;
        const headers = this.headers(token);
        return axiosInstance.post(url, {}, { headers });
    }
    
    async getBuddies(axiosInstance, token) {
        const url = `https://api.cryptorank.io/v0/tma/account/buddies`;
        const headers = this.headers(token);
        return axiosInstance.get(url, { headers });
    }

    async processBuddies(axiosInstance, token) {
        try {
            const buddiesResponse = await this.getBuddies(axiosInstance, token);
            const buddiesData = buddiesResponse.data;

            const currentTime = Math.floor(Date.now() / 1000);
            const cooldownTime = currentTime + buddiesData.cooldown; 

            if (buddiesData.cooldown === 0) {
                try {
                    await this.claimBuddies(axiosInstance, token);
                    this.log(`${'Claim buddies'.yellow} ${'thành công!'.green} Số lượng: ${buddiesData.totalBuddies}`);
                } catch (claimError) {
                    this.log(`${'Claim buddies'.yellow} ${'thất bại!'.red}`);
                }
            } else {
                const remainingTime = buddiesData.cooldown;
                this.log(`${'Claim ref:'.yellow} Còn ${remainingTime} giây để có thể claim lại`);
            }

            this.log(`${'Tổng số ref:'.cyan} ${buddiesData.totalBuddies}`);
            this.log(`${'Phần thưởng:'.cyan} ${buddiesData.reward}`);
            

        } catch (error) {
            this.log(`${'Lỗi khi xử lý buddies:'.red} ${error.message}`);
        }
    }
	
    async main() {
        let firstFarmCompleteTime = null;
    
        while (true) {
            for (let no = 0; no < this.tokens.length; no++) {
                const token = this.tokens[no];
                const proxy = this.proxies[no];
                const axiosInstance = this.createAxiosInstance(proxy);
    
                try {
                    const proxyIP = await this.checkProxyIP(proxy);
                    console.log(`========== Tài khoản ${no + 1} | IP: ${proxyIP} ==========`);
    
                    const accountResponse = await this.getAccount(axiosInstance, token);
                    const accountData = accountResponse.data;
                    const points = accountData.balance;
                    const lastFarming = accountData.farming;
    
                    this.log(`${'Balance:'.green} ${points}`);
                    let claimFarmSuccess = false;
					await this.processBuddies(axiosInstance, token);
                    await this.processTasks(axiosInstance, token);
                    if (lastFarming === null || lastFarming.state === 'END') {
                        try {
                            await this.startFarm(axiosInstance, token);
                            this.log(`${'Start farm thành công!'.green}`);
                            const updatedAccountResponse = await this.getAccount(axiosInstance, token);
                            const updatedLastFarming = updatedAccountResponse.data.farming;
                            if (no === 0) {
                                firstFarmCompleteTime = DateTime.fromMillis(updatedLastFarming.timestamp).plus({ hours: 6 });
                            }
                        } catch (startError) {
                            this.log(`${'Lỗi khi start farm!'.red}`);
                        }
                    } else if (lastFarming.state === 'START') {
                        const lastFarmingTime = DateTime.fromMillis(lastFarming.timestamp).plus({ hours: 6 });
                        this.log(`${'Thời gian hoàn thành farm:'.green} ${lastFarmingTime.toLocaleString(DateTime.DATETIME_FULL)}`);
                        if (no === 0) {
                            firstFarmCompleteTime = lastFarmingTime;
                        }
                        const now = DateTime.local();
                        if (now > lastFarmingTime) {
                            try {
                                await this.claimFarm(axiosInstance, token);
                                this.log(`${'Claim farm thành công!'.green}`);
                                claimFarmSuccess = true;
                            } catch (claimError) {
                                this.log(`${'Lỗi khi claim farm!'.red}`);
                            }
    
                            try {
                                await this.startFarm(axiosInstance, token);
                                this.log(`${'Start farm lại thành công!'.green}`);
                                const updatedAccountResponse = await this.getAccount(axiosInstance, token);
                                const updatedLastFarming = updatedAccountResponse.data.farming;
                                if (no === 0) {
                                    firstFarmCompleteTime = DateTime.fromMillis(updatedLastFarming.timestamp).plus({ hours: 6 });
                                }
                            } catch (startError) {
                                this.log(`${'Lỗi khi start farm lại!'.red}`);
                            }
                        }
                    }
                } catch (error) {
                    this.log(`${'Lỗi khi xử lý tài khoản'.red}`);
                    console.log(error);
                }
            }
    
            let waitTime;
            if (firstFarmCompleteTime) {
                const now = DateTime.local();
                const diff = firstFarmCompleteTime.diff(now, 'seconds').seconds;
                waitTime = Math.max(0, diff);
            } else {
                waitTime = 15 * 60;
            }
            await this.waitWithCountdown(Math.floor(waitTime));
        }
    }    
}

if (require.main === module) {
    const dancay = new Cryptorank();
    dancay.main().catch(err => {
        console.error(err);
        process.exit(1);
    });
}