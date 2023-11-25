export type MongoQuery<DocType = any> = {
    selector: any;
    skip?: number;
    limit?: number;
    sort: string[] // sort is not optional because sorting must be predictable
};
