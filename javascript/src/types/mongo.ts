export type MongoQuery = {
    selector: any;
    skip?: number;
    limit?: number;
    sort?: any[]
};
