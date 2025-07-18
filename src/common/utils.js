
export const groupBy = (x,f)=>x.reduce((a,b)=>((a[f(b)]||=[]).push(b), a),{});

export const average = arr => arr.reduce((acc,v) => acc + v) / arr.length;

// Utility function to get a nested property
export const getNestedProperty = (obj, keyPath) => {
    if (!keyPath) return obj;
    return keyPath.split('.').reduce((acc, key) => {
        return acc?.[key] !== undefined ? acc[key] : null;
    }, obj);
};