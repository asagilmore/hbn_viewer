import { defineStore } from 'pinia'
import datasets from "../../public/datasets.json"
import {listObjects, listCommonPrefixes,getUrl} from "./awsHelper.js"
import {groupByExtension} from "./logic.js"

//here were creating a pinia store for all the logic surrounding the data we are getting from our aws bucket
//we want to handle all the aws requests and data manipulation in one place.
//we then provide the processed data and some setter functions to the components that need it
export const useDataStore = defineStore({
    id: 'dataStore',
    state: () => ({
        datasets: datasets,
        dataset: Object.keys(datasets)[0],

        subjects: [],
        subject: null,

        sessions: [],
        session: null,

        files: [],

        scan: null,
        bundles: [],
    }),
    actions: {
        //Dataset functions
        getDataset(){
            return this.datasets[this.dataset];
        },
        getDatasets(){
            return this.datasets;
        },
        setDataset(key){
            if(key in this.datasets){
                this.dataset = key;
            } else {
                throw new Error(`Dataset with key ${key} not found.`);
            }
        },

        //subjects
        async updateSubjects() {
            let params = {
                Bucket: this.getDataset().bucket,
                Prefix: this.getDataset().prefix,
                Delimiter: "/"
            }
            let prefixes = await listCommonPrefixes(params, this.getDataset().participantsSize);
            this.subjects = getSubfolders(prefixes);
            this.subject = this.subjects[0];
        },
        setSubject(subject){
            this.subject = subject;
        },
        getSubject(){
            return this.subject;
        },

        //sessions
        //this will fail if there are subfolders, but no folder for sessions
        //for example
        //          subject-|
        //                  |-bundles-|
        //                  |-clean_bundles-|
        //for this it would set sessions = [bundles,clean_bundles]
        //if there is no folder for sessions it will return [{prefix: subject.value.prefix, folderName: "root"}]
        async updateSessions(){
            let output = [];
            let params = {
                Bucket: this.getDataset().bucket,
                Prefix: this.subject.value.prefix,
                Delimiter: "/"
            }
            let prefixes = await listCommonPrefixes(params, 100);
            output = getSubfolders(prefixes);
            if(output.length == 0){
                return [{prefix: subject.value.prefix, folderName: "root"}];
            }
            this.sessions = output;
            this.session = this.sessions[0]
        },
        setSession(session){
            this.session = session;
        },
        getSessions(){
            return this.sessions;
        },

        //files
        async updateFiles() {
            let params = {
                Bucket: this.getDataset().bucket,
                Prefix: this.sessions.prefix,
            }
            let files = await listObjects(params);
            let keys = files.Contents.map((item) => item.Key);
            var filesByExtension = groupByExtension(keys);

            //if dataset contains subfolder, get files in that subfolder
            //replace filesByExtension[subfolder.extension] with files in subfolder that have that extension
            if(this.getDataset().subfolders){
                for(let subfolder of this.getDataset().subfolders ){
                    let params = {
                        Bucket: dataset.value.bucket,
                        Prefix: session.value.prefix + subfolder.path,
                        Delimiter: "/"
                    }
                    let subfolderFiles = await listObjects(params);
                    let subfolderKeys = subfolderFiles.Contents.map((item) => item.Key);
                    let subfolderFilesByExtension = groupByExtension(subfolderKeys);
                    filesByExtension[subfolder.extension] = subfolderFilesByExtension[subfolder.extension];
                }
            }


            this.files = filesByExtension;
            return;
        },

        //scans
        getScans(){
            //check if niis exist
            if (this.files["nii.gz"].length > 0) {
                //match all names to files and return {name,path}
                let output = niis.value.reduce((acc, path, i) => {
                    this.dataset.scans.forEach((name) => {
                        if (path.includes(name)) {
                            acc.push({ name, path });
                        }
                    });
                    return acc;
                }, []);
                return output;
            } else {
                return [];
            }
        },
        getScanLink() {
            //check if scan is selected
            if(this.scan === null) return null
            //return link to scan
            let params = {
                Bucket: this.getDataset.bucket,
                Key: this.scan.path
            }
            return getUrl(params)
        },
        getScan(){
            return this.scan;
        },
        setScan(scan){
            this.scan = scan;
        },

        //implement later
        getBundleLinks(){
            //check if bundles are selected
            if(this.selectedBundles.length == 0) return null
        },
        setSelectedBundles(bundles){
            this.selectedBundles = bundles;
        },

    },
    //watchers
    watch: {
        dataset(newVal,oldVal) {
            this.getSubjects();
        },
        subject(newVal,oldVal) {
            this.getSessions();
        },
        session(newVal,oldVal){
            this.getFiles();
        }
    }
})
