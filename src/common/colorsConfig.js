
export const binningColorConfig = function (value) {
    if (value == 6) {
        return 'rgb(5, 48, 97)';
    } else if (value == 5) {
        return 'rgb(51, 124, 183)';
    } else if (value == 4) {
        return 'rgb(143, 194, 221)';
    } else if (value == 3) {
        return 'rgb(241, 163, 133)'
    } else if (value == 2) {
        return 'rgb(195, 61, 61)';
    } else if (value == 1) {
        return 'rgb(140, 13, 37)';
    } else return 'rgb(255, 255, 255)'
};

// Function assigning colors to every signal type
export const signalsColorFunction = (str) => {
  if (str === 'Dripper')
    return '#339CFFC5'
  if (str === 'Pluv Curr')
    return '#FFCD3DC5'
  if (str === 'Advice')
    return '#6064C8C5'
  if (str === 'Potential Evapotranspiration')
    return '#FA4443C5'
  if (str === 'Expected Water')
    return '#4CAF50C5'
  if (str === 'Sprinkler')
    return '#99ceff'
  if (str === 'Air Temperature')
    return '#339CFF'
}

export const deltaColorFunction = (str) => {
  if (str === 'Media ottimale')
    return '#6064C8'
  if (str === 'Media giornaliera')
    return '#339CFF'
  if (str === 'Asciutto')
    return '#fa5f43'
  if (str === 'Capacità di campo')
    return '#2cb8b8'
}