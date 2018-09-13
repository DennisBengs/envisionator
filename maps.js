'use strict';

/**
 * @file maps
 * @version 1.0.0
 * @author Donitz 2018
 */

const baseMaps = [
    'abbbbbbbbbbbbc' +
    'giiiiiiiiiiiih' +
    'giiiiiiiiiiiih' +
    'abbbbbbbbbbbbc' +
    'g            h' +
    'g            h' +
    'g            h' +
    'g            h' +
    'g            h' +
    'g            h' +
    'g            h' +
    'g            h' +
    'deeeeeeeeeeeef',

    '              ' +
    '              ' +
    '           ** ' +
    'deeeeeeeeeeeef' +
    '              ' +
    '              ' +
    '              ' +
    '              ' +
    '              ' +
    '              ' +
    '              ' +
    '              ' +
    '             %',

    '              ' +
    '              ' +
    '              ' +
    '??????????????' +
    '?            ?' +
    '?            ?' +
    '?            ?' +
    '?            ?' +
    '?            ?' +
    '?            ?' +
    '?            ?' +
    '?            ?' +
    '??????????????'];

const maps = [[
    ';             ' +
    '   P      P   ' +
    '              ' +
    '              ' +
    ' DDDDDDDDDDDD ' +
    '              ' +
    '  mn          ' +
    '              ' +
    '              ' +
    '              ' +
    '           "  ' +
    ' CCCCCCCCCCCC ' +
    '              ',
].concat(baseMaps), [
    ':             ' +
    ' *****        ' +
    '              ' +
    '              ' +
    '              ' +
    '              ' +
    '  ABBBBBBBBA  ' +
    '  B        B  ' +
    '  B >^  <  B  ' +
    '  ABBBBBBBBA  ' +
    '              ' +
    '              ' +
    '              ',

    '              ' +
    '              ' +
    '              ' +
    '              ' +
    '              ' +
    '              ' +
    '              ' +
    '   llllllll   ' +
    '   llllllll   ' +
    '              ' +
    '              ' +
    '              ' +
    '              ',
].concat(baseMaps), [
    ':             ' +
    ' ********     ' +
    '              ' +
    '              ' +
    '              ' +
    ' ABBBBBBBBBBA ' +
    ' B          B ' +
    ' B    ABA   B ' +
    ' B >^     < B ' +
    ' ABBBA   ABBA ' +
    '     B   B    ' +
    '     B   B    ' +
    '              ',

    '              ' +
    '              ' +
    '              ' +
    '              ' +
    '              ' +
    '      j       ' +
    '  llllllllll  ' +
    '  llll   lll  ' +
    '  llllllllll  ' +
    '      lll     ' +
    '              ' +
    '              ' +
    '              ',
].concat(baseMaps), [
    ':             ' +
    ' ************ ' +
    '              ' +
    '              ' +
    '      BBB     ' +
    ' ABBBBA ABBBA ' +
    ' B<         B ' +
    ' ABB   =BB  B ' +
    ' B          B ' +
    ' B      >^  B ' +
    ' B B B BBB=BA ' +
    ' B B B B      ' +
    '              ',

    '              ' +
    '              ' +
    '              ' +
    '              ' +
    '              ' +
    '       j      ' +
    '  llllllllll  ' +
    '    jjjj  jl  ' +
    '  lllllllljl  ' +
    '  lllllllljl  ' +
    '          j   ' +
    '              ' +
    '              ',

    '              ' +
    '              ' +
    '              ' +
    '              ' +
    '              ' +
    '       !      ' +
    '       .      ' +
    '       +. +   ' +
    '          .   ' +
    '          .   ' +
    '          +   ' +
    '              ' +
    '              ',
].concat(baseMaps), [
    ':             ' +
    ' ************ ' +
    '              ' +
    '              ' +
    '     ~~~~     ' +
    ' ?   ....   ? ' +
    ' ?FEE    EEF? ' +
    ' ?E  +.+   E? ' +
    ' ?E =  .   E? ' +
    ' ?E        E? ' +
    ' ?E>^     <E? ' +
    ' ?FEEEEEEEEF? ' +
    '              ',

    '              ' +
    '              ' +
    '              ' +
    '              ' +
    '              ' +
    '              ' +
    '     +        ' +
    '     ..       ' +
    '      ++.     ' +
    '              ' +
    '              ' +
    '              ' +
    '              ',

    '              ' +
    '              ' +
    '              ' +
    '              ' +
    '              ' +
    '              ' +
    '     .+       ' +
    '              ' +
    '    +.  +     ' +
    '        .     ' +
    '              ' +
    '              ' +
    '              ',

    '              ' +
    '              ' +
    '              ' +
    '              ' +
    '              ' +
    '              ' +
    '   kkkkkkkk   ' +
    '   kkkkkkkk   ' +
    '   kkkkkkkk   ' +
    '   kkkkkkkk   ' +
    '   kkkkkkkk   ' +
    '              ' +
    '              ',
].concat(baseMaps), [
    ':             ' +
    ' ************ ' +
    ' ******       ' +
    '              ' +
    '      FEEF    ' +
    '      E -E    ' +
    '  EEE E<.E    ' +
    '  E|FEEF E    ' +
    '  E.     FF   ' +
    '  E >^# .!E   ' +
    '  FEEEEEEEF   ' +
    '              ' +
    '              ',

    '              ' +
    '              ' +
    '              ' +
    '              ' +
    '              ' +
    '       ll     ' +
    '       ll     ' +
    '   l    l     ' +
    '   llllll     ' +
    '   lllllll    ' +
    '              ' +
    '              ' +
    '              ',
].concat(baseMaps), [
    ':             ' +
    ' ************ ' +
    ' **           ' +
    '              ' +
    '              ' +
    '    GGGGGG    ' +
    '    GG   G    ' +
    '    G ## G    ' +
    '    G ## G    ' +
    '    G>^#<G    ' +
    '    GGGGGG    ' +
    '              ' +
    '              ',

    '              ' +
    '              ' +
    '              ' +
    '              ' +
    '              ' +
    '      ooo     ' +
    '     oooo     ' +
    '     oooo     ' +
    '     oooo     ' +
    '     oooo     ' +
    '              ' +
    '              ' +
    '              ',
].concat(baseMaps), [
    ':             ' +
    '              ' +
    '              ' +
    '              ' +
    ' ???BA        ' +
    ' B   B AB     ' +
    ' ABB B B.++ + ' +
    ' B B B B! ... ' +
    ' B   ABAB  +  ' +
    ' B   B~ B     ' +
    ' B>^  .<B     ' +
    ' ABBBBBBA     ' +
    '              ',

    '              ' +
    ' ************ ' +
    '              ' +
    '              ' +
    ' ppp          ' +
    '              ' +
    '        o .+= ' +
    '        o.    ' +
    '         + .+ ' +
    '              ' +
    '              ' +
    '              ' +
    '              ',

    '              ' +
    '              ' +
    '              ' +
    '              ' +
    '              ' +
    '  lll         ' +
    '    l         ' +
    '  l l         ' +
    '  lll    .+   ' +
    '  lll ll      ' +
    '  llllll      ' +
    '              ' +
    '              ',
].concat(baseMaps), [
    ':             ' +
    ' ************ ' +
    '              ' +
    '              ' +
    '              ' +
    '  ??????????  ' +
    '  H D      I  ' +
    '  H   mn   I  ' +
    '  H>^    < I  ' +
    '  DCCK**LCCD  ' +
    '     H  I     ' +
    '         I    ' +
    '              ',

    '              ' +
    '              ' +
    '              ' +
    '              ' +
    '              ' +
    '              ' +
    '              ' +
    '              ' +
    '              ' +
    '      ii      ' +
    '              ' +
    '     ~.       ' +
    '              ',

    '              ' +
    '              ' +
    '              ' +
    '              ' +
    '              ' +
    '              ' +
    '   oooooooo   ' +
    '   oooooooo   ' +
    '   oooooooo   ' +
    '      ii      ' +
    '      ii      ' +
    '              ' +
    '              ',
].concat(baseMaps), [
    ':             ' +
    ' ************ ' +
    ' **********   ' +
    '              ' +
    '              ' +
    ' JJJJJJJJJ    ' +
    ' J   ~ J J    ' +
    ' J!. . J JJJ  ' +
    ' J#      =    ' +
    '  #>^     =<  ' +
    ' JJJJJJJJJJJ  ' +
    '              ' +
    '              ',

    '              ' +
    '              ' +
    '              ' +
    '              ' +
    '              ' +
    '              ' +
    '              ' +
    '              ' +
    '         .    ' +
    '         ++   ' +
    '          .   ' +
    '              ' +
    '              ',

    '              ' +
    '              ' +
    '              ' +
    '              ' +
    '              ' +
    '              ' +
    '              ' +
    '         .    ' +
    '         ++   ' +
    '          .   ' +
    '              ' +
    '              ' +
    '              ',

    '              ' +
    '              ' +
    '              ' +
    '              ' +
    '              ' +
    '              ' +
    '  lllll l     ' +
    '  lllll l     ' +
    '  llllllllll  ' +
    '  llllllllll  ' +
    '              ' +
    '              ' +
    '              ',
].concat(baseMaps), [
    ':             ' +
    ' **           ' +
    '              ' +
    '              ' +
    '              ' +
    ' DDDDDDDDD    ' +
    '              ' +
    ' -.   ?       ' +
    '              ' +
    ' CCCCCCCCC    ' +
    ' DDDDDDDDD    ' +
    ' >^ $         ' +
    '              ',

    '              ' +
    '              ' +
    '              ' +
    '              ' +
    '              ' +
    '              ' +
    ' ooooooooo    ' +
    ' oomnooooo    ' +
    ' ooooooooo    ' +
    '              ' +
    '    !         ' +
    '    .         ' +
    '              ',

    '              ' +
    '              ' +
    '              ' +
    '              ' +
    ' pppppppppppp ' +
    '       pppppp ' +
    '       pppppp ' +
    '       pppppp ' +
    '       pppppp ' +
    '       pppppp ' +
    ' pppppppppppp ' +
    '  ppppppppppp ' +
    '              ',
].concat(baseMaps)];

const mapNames = [
    '',
    'A NEW HOPE',
    'PITFALL',
    'UP AND AWAY',
    'SHADOW',
    'TRIGGER',
    'CLAUSTROPHOBIA',
    'PATIENCE',
    'META',
    'EXAM',
    'DO IT',
];

const dialogues = [
    // Title
    'ENVISIONATOR\n\n\nMADE BY DONITZ FOR JS13KGAMES\nMUSIC:\nNURYKABE MIDI 01 - CONTRE01 BY MORUSQUE\n(CC BY 3.0, HIGHLY EDITED)\nCONTROLS:\n\u2190\u2192\u2191\u2193 - MOVE    Z - ACTION\nX - ERASE    M - MUTE\nPRESS Z TO START',

    // Level 1
    '~~~Hey!~~ You there!~~\nYes you!~~ Come over here!|' +
    'Do you see the little robot,~~\nthe one on the monitor?|' +
    'That\'s a Fixed Input Field Operator.~~\nYou need to get it through the door.|' +
    'Use the arrow keys to define moves,~~\nthen press Z to activate the FIFO.|',

    // Level 2
    '~~~The building is under lockdown and\nall outside communications are down.|' +
    'I was working late in my lab when the\ndoors locked,~~ and now I\'m locked in.|' +
    'Fortunately the FIFO control network\nwas isolated and is still active.|',

    // Level 3
    '~~~As you may have noticed,~\nthe room layout is ridiculous.|' +
    'Some speculate the architect was mad.~~\nOthers say they were built by weasels.|',

    // Level 4
    '~~~I told them a plasma beam security\nsystem was overkill.|' +
    'They said,~ "that\'s the point"~~~\nWhat\'s next?~ A self-destruct button?|',

    // Level 5
    '~~~Please hurry.~~~ It smells in here~~.~~.~~.~~\nSmells like,~~~~~ p~a~p~e~r~s~?~&' +
    'Okay fine!~~ I\'m stuck in the toilet.~~\nAll the more reason for you to hurry!|',

    // Level 6
    '~~~You know,~~ I don\'t even know what\nthe FIFO is used for.|' +
    'Is it like a vacuum cleaner,~~\nor a mobile bar?|' +
    'I want one!|',

    // Level 7
    '~~~What are you doing?~~ Don\'t touch the%&' +
    'H~e~e~e~e~y.~~~ This is the room with\nthe thing!~~~~ Wow,~~ just look at that!|' +
    'Marvelous.|',

    // Level 8
    '~~~WHO~~~~ %*BANG*~~~ REINFORCES~~ %*CRASH*~~~~\nA~~~~ %*KADONK*~~~~ TOILET DOOR!?|' +
    '*huff*~~.~~.~~.~~~~\nOkay,~~ back to unrolling toilet paper.|',

    // Level 9
    '~~~Just one more level to go!~~ I can already\nfeel the fresh air in my hair.|' +
    'Yes~~',

    // Level 10
    '~~~There it is!~~~ The door to our freedom!~~~\nQuick!~ Use the beam to blast it open!|',

    '>~~~~~~~~~~~~~~~~~~~~~~~~Since this is the last time we~~ speak~~~~~~%>~~~\nI have something to admit.~~~~~~~~~~~~~~\n\n' +
    '    There was no toilet.~~~~%>~~~~~~~~~~~~~~~~\n        I caused the lockdown.~~~~%>~~~~~~~~~~~~~~~~\n                I~~ ~~a~~m>~>~>~>~>~>~>~>~~~>^',
];
