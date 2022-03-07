
function sequence({ seed, size, max }) {
    const rand = () => {
        const x = Math.sin(seed++) * 10000;
        return x - Math.floor(x);
    }
    const nextInt = () => {
        return Math.floor(rand() * max);
    }
    let arr = [];
    for (let i=0; i < size; i++) {
        arr.push(nextInt());
    }
    return arr;
}

export default sequence;
