const {readfiledata,readquerydata,readproxydata,readtokendata,savetokendata,httpsapi,cmdtitle,sleep,waiting,countdown,nowlog,fNumber,readbotdata} = require('./aapi_request.js')
const proxyfile = 'proxy.txt'
const proxylist = readfiledata(proxyfile)

const botname = "CRANK"
const {queryfile,tokenfile}  = readbotdata(botname)
const queryids = readfiledata(queryfile)

class BOT{
    constructor(){
        this.headers = {
            "accept": "*/*",
            "accept-language": "en,vi-VN;q=0.9,vi;q=0.8",
            "priority": "u=1, i",
            "sec-ch-ua": "\"Not/A)Brand\";v=\"8\", \"Chromium\";v=\"126\", \"Google Chrome\";v=\"126\"",
            "sec-ch-ua-mobile": "?1",
            "sec-ch-ua-platform": "\"Android\"",
            "sec-fetch-dest": "empty",
            "sec-fetch-mode": "cors",
            "sec-fetch-site": "same-site",
            "Referer": "https://tma.cryptorank.io/",
            "Referrer-Policy": "strict-origin-when-cross-origin"
        }
    }
    async getuserdata (callHeaders,proxy) {
        const url = 'https://api.cryptorank.io/v0/tma/account';
        try{
            const response = await httpsapi("GET",url,callHeaders,proxy)
            nowlog('Get UserData Success!','success')
            return response.data;
        }catch{
            nowlog('Error Get Data!','error')
            return null
        }
    }
    async startClaim (callHeaders,proxy) {
        const url = 'https://api.cryptorank.io/v0/tma/account/start-farming';
        try{
            const response = await httpsapi("POST",url,callHeaders,proxy)
            nowlog('Start Farming Sucessful!','success')
            return response.data.farming
        }catch{
            nowlog('Error Start Farm','error')
            return null
        }
    }
    async finishClaim (callHeaders,proxy) {
        const url = 'https://api.cryptorank.io/v0/tma/account/end-farming';
        try{
            const response = await httpsapi("POST",url,callHeaders,proxy)
            nowlog('Claim Farming Sucessful!','success')
            return response.data.farming
        }catch{
            nowlog('Error Claim Farm!','error')
            return null
        }
    }
    async getTasks(callHeaders,proxy) {
        const url = 'https://api.cryptorank.io/v0/tma/account/tasks';
        try{
            const response = await httpsapi("GET",url,callHeaders,proxy)
            nowlog('Get Task Sucessful!','success')
            return response.data
        }catch{
            nowlog('Error Get Task!','error')
            return null
        }
    }
    async claimTask(callHeaders,proxy,taskId,name) {
        const url = `https://api.cryptorank.io/v0/tma/account/claim/task/${taskId}`;
        const response = await httpsapi("POST",url,callHeaders,proxy)
        return response.data.balance
    }
            
    async processTasks(callHeaders,proxy) {
        const skippedTasks = [
            "324dc84b-9bea-433c-8035-8d1c161727d8",
            "78784743-bddc-42fb-9845-8c57dfba64d3",
            "cdd8ac0b-c800-4531-8905-500ef4a9c9d5",
            "848db658-afb6-4d02-b0be-a37424b516a8",
            "c2783239-8ee6-4f2a-9b59-4722c75f1ace"
        ];            
        const tasks = await this.getTasks(callHeaders,proxy);
        for (const task of tasks) {
            const {id, name, isDone} = task;
            if (skippedTasks.includes(id)) {
                continue;
            }
            if(!isDone){
                try{
                    const balance = await this.claimTask(callHeaders,proxy,id,name);
                    nowlog(`Claim Task ${name} Done | Balance ${fNumber(balance)}`,'success')
                }catch{
                    nowlog(`Error Claim Task ${name}`,'error')
                    return null
                }
            }
        }
        nowlog('All Task Has Passed','warning')
    }

    async main(){
        await countdown(5,botname)
        while(true){
            for(let i = 0; i < queryids.length; i++){
                const {user,queryid}= readquerydata(queryids,i);
                const proxy = await readproxydata(proxylist,i)
                nowlog(`${botname} BOT: Run User[${i+1}] - ID: ${user.id}`,'special')
                cmdtitle(user.id,botname)

                let token = readtokendata(tokenfile,user.id)
                this.headers['Authorization'] = token

                try {
                    const responseData = await this.getuserdata(this.headers,proxy);
                    let {balance,farming} = responseData;
                    let {state,timestamp} = farming;
                    const currenttime = Date.now()/1000;
                    let farmtime = timestamp/1000 + 6*3600;
                    let timeleft = farmtime - currenttime;

                    nowlog(`=========/ ${botname} FARM /=========`);
                    nowlog(`Balance : ${fNumber(balance)} ${botname}`);
                    this.headers["content-type"] = "application/json"

                    await this.processTasks(this.headers,proxy)

                    if (state === "START"){
                        nowlog('Processing Farming...','warning');
                        const time = Math.floor(timeleft)+60;
                        await countdown(time,botname)
                        await this.finishClaim(this.headers,proxy);
                        await sleep(3)                              
                        await this.startClaim(this.headers,proxy)
                        await sleep(3)                              
                    } else {
                        await this.startClaim(this.headers,proxy)
                        await sleep(3)                              
                    }   
                } catch (error) {
                    nowlog(`Error Get Data User ${user.id}!, ${error.message}`,'error');
                    await waiting(5,botname)
                } 
            }
            await countdown(600,botname)
        }
    }
}

if (require.main === module) {
    const bot = new BOT();
    bot.main().catch(error => {
        nowlog(`${error.message}`,'error');
    });
}