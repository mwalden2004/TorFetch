/*
Note to anyone who attempts to finish this.... God help you...
I have spent 5 hours trying to get this to work with node-fetch, before I decided to to attempt to use axios.
That didn't work, http would occasionly decide to work -- but HTTPS decided it was too good to come in today.
I wish you lick, I was really hoping this would work, but hey... failure is ok sometimes?
Some information, SendControlMessage, and newTorSession works, it allows you to reset the tor connection to
exchange for a new IP address -- this is the magic of Tor which is why I decided to make this projet.

If you get this to work, PLEASE make a pull-request! For now, I am throwing in the towel and may resume later.


TorFetch
A class for fetching data over Tor wrapping around node-fetch.

Made to allow fetching data without rate-limits.
Based off of https://github.com/talmobi/tor-request
Wrote to be compatible with latest node versions, and be easier to use.

Author: Matthew Walden <matthew@mwalden.tech>
Authored: 11/25/21
*/

import { TorTypes } from './types/TorTypes';
//@ts-ignore Unfortuently node-fetch v3 has some unsupported behavior in ts.
import Socks5Agent from "axios-socks5-agent"
import Axios from "axios";
//@ts-ignore
import { connect } from 'net'; // to communicate with the Tor clients ControlPort
//@ts-ignore
import { EOL } from 'os'; // for os EOL character

export default class TorFetch {
    private host: string;
    private port: number;
    private controlPort: number;
    private controlPassword?: string;
    private controlEnabled: boolean;
    private socksUrl: string;

    constructor(options: TorTypes) {
        this.host = options.host || 'localhost';
        this.port = options.port || 9050;
        this.controlPort = options.controlPort || 9051;
        this.controlPassword = options.password;
        this.controlEnabled = options.password !== undefined || options.controlPort !== undefined;

        this.socksUrl = `${this.host}:${this.port}`;
    }

    private sendControlMessage(commands: string[]): Promise<any> {
        return new Promise(async (resolve, reject) => {
            try {
                const socket = connect({ // Connect via net.connect to the Tor ControlPort
                    host: this.host,
                    port: this.controlPort
                }, async () => { // On connect
                    socket.write(commands.join('\n') + '\n'); // Send all commands on connection.
                })

                let data = ''
                socket.on('data', (chunk) => {
                    data += chunk.toString()
                })

                socket.on('end', () => {
                    resolve(data)
                })

                //Socket Communication Stuff
                socket.on('error', (err) => {
                    reject(err || 'ControlPort communication error')
                })
            } catch (e) {
                reject(e)
            }
        });
    }

    public newTorSession(): Promise<void> {
        return new Promise(async (resolve, reject) => {
            if (!this.controlEnabled) {
                throw new Error('Cannot create new Tor session without specifying control port and password');
            }

            try {
                //Send the magic phrases to renew Tor session.
                const data = await this.sendControlMessage([`authenticate "${this.controlPassword}"`, 'signal newnym', 'quit']);
                //Split at new-lines and remove the last element (empty string)
                const lines = data.split(EOL).slice(0, -1) as string[];
                //Check if all responses start with 250 (OK STATUS)
                const mapped = lines.map(line => line.substring(0,3)) as string[];
                const success = mapped.every(val => val === '250') as boolean;

                if (success) {
                    resolve();
                }else{
                    reject(new Error(`Error communicating with Tor ControlPort\n${data}`));
                }
            } catch (e) {
                reject(e)
            }
        })
    }
    public async fetch(url: string, options?: any): Promise<any> {
        const { httpAgent, httpsAgent } = Socks5Agent({
            host: this.host,
            port: this.port,
            agentOptions: {
                keepAlive: false,
                scheduling: "fifo"
            }
        });

        Axios.create({
            baseURL: "https://google.com",
            httpAgent,
            httpsAgent
        }).get("/").then(console.log)

        //const client = Axios({url, ...options, httpAgent, httpsAgent});
        //return client;
    }




}