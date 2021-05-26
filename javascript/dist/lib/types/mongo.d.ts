export declare type MongoQuery<DocType = any> = {
    selector: any;
    skip?: number;
    limit?: number;
    sort: any[];
};
