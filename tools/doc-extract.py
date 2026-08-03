#!/usr/bin/env python3
# 舊版 Word .doc 文字抽取（無需外部套件）：解析 OLE 複合檔 + Word piece table
# 用法: python3 tools/doc-extract.py <input.doc> <output.txt>
import struct, sys, re

def cfb(path):
    d = open(path, 'rb').read()
    ssz = 1 << struct.unpack('<H', d[30:32])[0]
    mssz = 1 << struct.unpack('<H', d[32:34])[0]
    dirstart = struct.unpack('<I', d[48:52])[0]
    minicut = struct.unpack('<I', d[56:60])[0]
    minifatstart = struct.unpack('<I', d[60:64])[0]
    nminifat = struct.unpack('<I', d[64:68])[0]
    difstart = struct.unpack('<I', d[68:72])[0]
    ndif = struct.unpack('<I', d[72:76])[0]
    difat = list(struct.unpack('<109I', d[76:512]))
    s = difstart
    for _ in range(ndif):
        sec = d[512 + s * ssz:512 + (s + 1) * ssz]
        vals = struct.unpack('<%dI' % (ssz // 4), sec)
        difat += list(vals[:-1]); s = vals[-1]
        if s in (0xFFFFFFFE, 0xFFFFFFFF): break
    fat = []
    for fs in difat:
        if fs in (0xFFFFFFFE, 0xFFFFFFFF): continue
        fat += list(struct.unpack('<%dI' % (ssz // 4), d[512 + fs * ssz:512 + (fs + 1) * ssz]))
    def chain(start):
        out = b''; s = start; g = 0
        while s not in (0xFFFFFFFE, 0xFFFFFFFF) and s < len(fat) and g < 200000:
            out += d[512 + s * ssz:512 + (s + 1) * ssz]; s = fat[s]; g += 1
        return out
    dirdata = chain(dirstart); entries = []
    for i in range(len(dirdata) // 128):
        e = dirdata[i * 128:(i + 1) * 128]
        nlen = struct.unpack('<H', e[64:66])[0]
        if nlen == 0 or nlen > 64: continue
        entries.append((e[:nlen - 2].decode('utf-16-le', 'ignore'), e[66],
                        struct.unpack('<I', e[116:120])[0], struct.unpack('<Q', e[120:128])[0]))
    root = [e for e in entries if e[1] == 5][0]
    ministream = chain(root[2])
    mf = chain(minifatstart) if nminifat else b''
    minifat = list(struct.unpack('<%dI' % (len(mf) // 4), mf)) if mf else []
    def read(name):
        e = [x for x in entries if x[0] == name][0]
        if e[3] < minicut and e[1] == 2:
            out = b''; s = e[2]; g = 0
            while s not in (0xFFFFFFFE, 0xFFFFFFFF) and s < len(minifat) and g < 200000:
                out += ministream[s * mssz:(s + 1) * mssz]; s = minifat[s]; g += 1
            return out[:e[3]]
        return chain(e[2])[:e[3]]
    return read

def extract(path):
    read = cfb(path)
    wd = read('WordDocument')
    try: tb = read('1Table')
    except IndexError: tb = read('0Table')
    # 掃描 1Table 找 Pcdt(0x02 + lcb + 遞增 CP 陣列)
    for i in range(len(tb) - 9):
        if tb[i] != 2: continue
        lcb = struct.unpack('<I', tb[i + 1:i + 5])[0]
        if lcb < 16 or i + 5 + lcb > len(tb) or (lcb - 4) % 12: continue
        n = (lcb - 4) // 12
        try: cps = struct.unpack('<%dI' % (n + 1), tb[i + 5:i + 5 + 4 * (n + 1)])
        except struct.error: continue
        if cps[0] != 0 or any(cps[k] >= cps[k + 1] for k in range(n)) or cps[-1] > 10_000_000: continue
        plc = tb[i + 5:i + 5 + lcb]
        text = []
        for k in range(n):
            pcd = plc[4 * (n + 1) + 8 * k:4 * (n + 1) + 8 * (k + 1)]
            fc = struct.unpack('<I', pcd[2:6])[0]
            ln = cps[k + 1] - cps[k]
            if fc & 0x40000000:
                fc = (fc & 0x3FFFFFFF) >> 1
                text.append(wd[fc:fc + ln].decode('cp1252', 'ignore'))
            else:
                text.append(wd[fc:fc + 2 * ln].decode('utf-16-le', 'ignore'))
        return ''.join(text)
    raise SystemExit('piece table not found')

if __name__ == '__main__':
    t = extract(sys.argv[1])
    open(sys.argv[2], 'w').write(t)
    cjk = len(re.findall(r'[一-鿿]', t))
    print(f'{sys.argv[2]}: {len(t)} chars, {cjk} cjk')
