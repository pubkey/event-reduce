export type MongoQuery<DocType = any> = {
    selector: any;
    skip?: number;
    limit?: number;
    sort: string[];
};
