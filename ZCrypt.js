var ZCrypt = ZCrypt || {};
ZCrypt.ADD = 0;
ZCrypt.SUB = 1;
ZCrypt.XOR = 2;
ZCrypt.NOT = 3;
ZCrypt.SHIFT = 4;
ZCrypt.ADD_MORPH = 5;
ZCrypt.SUB_MORPH = 6;
ZCrypt.XOR_MORPH = 7;
ZCrypt.NEG = 8;

ZCrypt.int_rand = function(min, max)
{
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

ZCrypt.make_add = function()
{
    return [[ZCrypt.ADD, ZCrypt.do_add], ZCrypt.int_rand(0x10, 0xff)];
}

ZCrypt.make_sub = function()
{
    return [[ZCrypt.SUB, ZCrypt.do_sub], ZCrypt.int_rand(0x10, 0xff)];
}

ZCrypt.make_xor = function()
{
    return [[ZCrypt.XOR, ZCrypt.do_xor], ZCrypt.int_rand(0x10, 0xff)];
}

ZCrypt.make_not = function()
{
    return [[ZCrypt.NOT, ZCrypt.do_not]];
}

ZCrypt.make_neg = function()
{
    return [[ZCrypt.NEG, ZCrypt.do_neg]];
}

ZCrypt.make_shift = function()
{
    let bits1 = ZCrypt.int_rand(1, 6);

    if (bits1 === 4)
        bits1 = 7;

    const bits2 = 8 - bits1;

    return [[ZCrypt.SHIFT, ZCrypt.do_shift], [bits1, bits2]];
}

ZCrypt.make_add_morph = function()
{
    return [[ZCrypt.ADD_MORPH, ZCrypt.do_add_morph]];
}

ZCrypt.make_sub_morph = function()
{
    return [[ZCrypt.SUB_MORPH, ZCrypt.do_sub_morph]];
}

ZCrypt.make_xor_morph = function()
{
    return [[ZCrypt.XOR_MORPH, ZCrypt.do_xor_morph]];
}

ZCrypt.do_add = function(c, arg)
{
    return (c + arg) & 0xff;
}

ZCrypt.do_sub = function(c, arg)
{
    return (c - arg) & 0xff;
}

ZCrypt.do_xor = function(c, arg)
{
    return (c ^ arg) & 0xff;
}

ZCrypt.do_not = function(c)
{
    return (~c) & 0xff;
}

ZCrypt.do_neg = function(c)
{
    return (-c) & 0xff;
}

ZCrypt.do_shift = function(c, args)
{
    return ((c >> args[0]) & 0xff) | ((c << args[1]) & 0xff);
}

ZCrypt.do_add_morph = function(c, args, morph)
{
    return ZCrypt.do_add(c, morph);
}

ZCrypt.do_sub_morph = function(c, args, morph)
{
    return ZCrypt.do_sub(c, morph);
}

ZCrypt.do_xor_morph = function(c, args, morph)
{
    return ZCrypt.do_xor(c, morph);
}

ZCrypt.remove_by_value = function(array, value)
{
    const ret = [];
    for (let i = 0; i < array.length; ++i)
        if (array[i] !== value)
            ret.push(array[i]);

    return ret;
}

ZCrypt.remove_all_by_value = function(array, removes)
{
    let ret = array.slice();
    for (let i = 0; i < removes.length; ++i)
        ret = ZCrypt.remove_by_value(ret, removes[i]);

    return ret;
}

ZCrypt.make_ops = function(rounds, add, sub, xor, not, shift, morph, neg)
{
    const master = [];
    if (add) master.push(ZCrypt.make_add);
    if (sub) master.push(ZCrypt.make_sub);
    if (xor) master.push(ZCrypt.make_xor);
    if (not) master.push(ZCrypt.make_not);
    if (shift) master.push(ZCrypt.make_shift);
    if (add && morph) master.push(ZCrypt.make_add_morph);
    if (sub && morph) master.push(ZCrypt.make_sub_morph);
    if (xor && morph) master.push(ZCrypt.make_xor_morph);
    if (neg) master.push(ZCrypt.make_neg);

    const nops = [];
    nops.push([ZCrypt.make_add, ZCrypt.make_add_morph, ZCrypt.make_sub, ZCrypt.make_sub_morph]);
    nops.push([ZCrypt.make_xor, ZCrypt.make_xor_morph]);

    let last = -1;
    const ops = [];

    for (let round = 0; round < rounds; ++round)
    {
        let current = master.slice();
        if (current.length > 1)
        {
            for (let i = 0; i < nops.length; ++i)
                for (let item = 0; item < nops[i].length; ++item)
                    if (last === nops[i][item])
                        current = ZCrypt.remove_all_by_value(current, nops[i]);

            current = ZCrypt.remove_by_value(current, last);
        }

        last = current[Math.floor(Math.random() * current.length)];
        ops.push(last());
    }

    return ops;
}

ZCrypt.do_crypt = function(str, rounds, add, sub, xor, not, shift, morph, neg)
{
    const ops = ZCrypt.make_ops(rounds, add, sub, xor, not, shift, morph, neg);

    const cs = [];

    for (let i = 0; i < str.length; ++i)
    {
        let c = str.charCodeAt(i) & 0xff;
        for (let op_idx = 0; op_idx < ops.length; ++op_idx)
        {
            const callback = ops[op_idx][0][1];
            const args = ops[op_idx][1];
            c = callback(c, args, i);
        }
        cs.push(c);
    }

    return [ops, cs];
}

ZCrypt.generate_c = function(ops, cs)
{

    let code = "";
    code += "byte[] s = \n{";

    for (let i = 0; i < cs.length; ++i)
    {
        if ((i % 8) === 0)
            code += "\n    ";

        code += "0x" + cs[i].toString(16) + ", ";
    }

    code = code.slice(0, -2);

    code += "\n};\n\n";

    code += "for (uint i = 0; i < s.Length; i++)\n{\n"
    code += "    byte c = s[i];\n";

    ops = ops.reverse();
    for (let i = 0; i < ops.length; ++i)
    {
        code += "    c ";

        const op = ops[i][0][0];
        switch (op)
        {
            case ZCrypt.ADD:
                code += "-= 0x" + ops[i][1].toString(16);
                break;
            case ZCrypt.SUB:
                code += "+= 0x" + ops[i][1].toString(16);
                break;
            case ZCrypt.NOT:
                code += "= (byte)~c";
                break;
            case ZCrypt.XOR:
                code += "^= 0x" + ops[i][1].toString(16);
                break;
            case ZCrypt.SHIFT:
                const first = "0x" + ops[i][1][1].toString(16);
                const second = "0x" + ops[i][1][0].toString(16);
                code += "= (byte)((c >> " + first + ") | (c << " + second  + "))";
                break;
            case ZCrypt.ADD_MORPH:
                code += "-= (byte)i"
                break;
            case ZCrypt.SUB_MORPH:
                code += "+= (byte)i"
                break;
            case ZCrypt.XOR_MORPH:
                code += "^= (byte)i"
                break;
            case ZCrypt.NEG:
                code += "= (byte)-c"
                break;
            default:
                code += "UNKNOWN OP = + " + op.toString();
                break;
        }

        code += ";\n"

    }

    code += "    s[i] = c;\n}\n\n";

    code += 'Console.WriteLine(Encoding.UTF8.GetString(s));';

    return code;
}

ZCrypt.generate_encryption = function(ops, cs)
{

    let code = "\n\n//Encryption Routine\n";

    code += "private static byte[] Encrypt(string s)\n{\n";
    code += "   byte[] output = new byte[s.Length];\n";
    code += "   for (int i = 0; i < s.Length; i++)\n   {\n";
    code += "       byte c = (byte) s[i];\n";

    ops = ops.reverse();
    for (let i = 0; i < ops.length; ++i)
    {
        code += "       c ";

        const op = ops[i][0][0];
        switch (op)
        {
            case ZCrypt.ADD:
                code += "+= 0x" + ops[i][1].toString(16);
                break;
            case ZCrypt.SUB:
                code += "-= 0x" + ops[i][1].toString(16);
                break;
            case ZCrypt.NOT:
                code += "= (byte)~c";
                break;
            case ZCrypt.XOR:
                code += "^= 0x" + ops[i][1].toString(16);
                break;
            case ZCrypt.SHIFT:
                const first = "0x" + ops[i][1][1].toString(16);
                const second = "0x" + ops[i][1][0].toString(16);
                code += "= (byte)((c << " + first + ") | (c >> " + second  + "))";
                break;
            case ZCrypt.ADD_MORPH:
                code += "+= (byte)i"
                break;
            case ZCrypt.SUB_MORPH:
                code += "-= (byte)i"
                break;
            case ZCrypt.XOR_MORPH:
                code += "^= (byte)i"
                break;
            case ZCrypt.NEG:
                code += "= (byte)-c"
                break;
            default:
                code += "UNKNOWN OP = + " + op.toString();
                break;
        }

        code += ";\n"

    }

    code += "       output[i] = c;\n   }\n";

    code += "   return output;\n}"

    return code;
}

ZCrypt.cryptstr = function()
{
    const add = document.getElementById('zcrypt_add').checked;
    const sub = document.getElementById('zcrypt_sub').checked;
    const xor = document.getElementById('zcrypt_xor').checked;
    const not = document.getElementById('zcrypt_not').checked;
    const shift = document.getElementById('zcrypt_shift').checked;
    const morph = document.getElementById('zcrypt_morph').checked;
    const neg = document.getElementById('zcrypt_neg').checked;
    let str = document.getElementById('zcrypt_plaintext').value;
    const rounds = parseInt(document.getElementById('zcrypt_rounds').value);
    const makeEncryption = document.getElementById('zcrypt_encryption').checked;

    if (isNaN(rounds) || rounds >= 100 || rounds <= 0)
    {
        $('#danger').show()
        setTimeout(function () {
            $('#danger').fadeOut('slow');
        }, 3000);
        return;
    }

    try {
        str += "\x00";

        let args = ZCrypt.do_crypt(str, rounds, add, sub, xor, not, shift, morph, neg);
        //document.getElementById('zcrypt_encryption').value = ZCrypt.generate_encryption(args[0], args[1]);
        document.getElementById('zcrypt_code').value = ZCrypt.generate_c(args[0], args[1]);
        if (makeEncryption)
            document.getElementById('zcrypt_code').value += ZCrypt.generate_encryption(args[0], args[1]);
    } catch (e) {
        alert(e);
        return;
    }
}
